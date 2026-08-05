import { z } from 'zod'
import { canTransitionOrder } from '@/features/orders/status'
import type { Json } from '@/types/database'
import type { OrderStatus } from '@/types/store'

const orderIdSchema = z.string().uuid()
const orderStatusSchema = z.enum([
  'pending_payment',
  'paid',
  'preparing',
  'shipped',
  'collected',
  'cancelled',
])

export interface AdminOrderRepository {
  getOrderStatus(orderId: string): Promise<OrderStatus | null>
  transitionOrder(
    orderId: string,
    expectedStatus: OrderStatus,
    nextStatus: OrderStatus,
    updatedAt: string,
  ): Promise<void>
  saveMerchantReply(orderId: string, reply: string): Promise<void>
}

export type AdminOrderFilters = {
  query: string
  status: OrderStatus | ''
}

export type AdminOrderSummary = {
  id: string
  orderNumber: string
  recipientName: string
  email: string
  total: number
  status: OrderStatus
  createdAt: string
}

export type AdminOrderDetail = AdminOrderSummary & {
  recipientPhone: string
  storeChain: string
  storeId: string
  storeName: string
  customerNote: string
  merchantReply: string
  paymentMethod: string
  bankTransferLastFive: string | null
  bankTransferSubmittedAt: string | null
  subtotal: number
  shippingFee: number
  items: Array<{
    id: string
    productName: string
    sku: string
    color: string
    size: string
    unitPrice: number
    quantity: number
  }>
  payment: {
    status: string
    providerReference: string | null
    paidAt: string | null
  } | null
}

export type AdminPaymentReviewSummary = {
  id: string
  email: string
  recipientName: string
  total: number
  reviewCode: string
  reviewReason: string
  createdAt: string
}

export type AdminPaymentReviewDetail = AdminPaymentReviewSummary & {
  recipientPhone: string
  providerReference: string | null
  storeChain: string
  storeId: string
  storeName: string
  subtotal: number
  shippingFee: number
  items: Array<{
    variantId: string
    productName: string
    sku: string
    color: string
    size: string
    unitPrice: number
    quantity: number
  }>
}

export interface AdminOrderQueryRepository {
  listOrders(filters: AdminOrderFilters): Promise<AdminOrderSummary[]>
  listOrderExports(filters: AdminOrderFilters): Promise<AdminOrderDetail[]>
  getOrder(orderNumber: string): Promise<AdminOrderDetail | null>
  listPaymentAttemptsRequiringReview(): Promise<AdminPaymentReviewSummary[]>
  getPaymentAttemptForReview(attemptId: string): Promise<AdminPaymentReviewDetail | null>
}

type AdminOrderQueryDependencies = {
  repository: AdminOrderQueryRepository
  requireAdmin: () => Promise<unknown>
}

function normalizeFilters(filters: Partial<AdminOrderFilters>): AdminOrderFilters {
  const status = orderStatusSchema.safeParse(filters.status)
  return {
    query: filters.query?.trim() ?? '',
    status: status.success ? status.data : '',
  }
}

export function createAdminOrderQueries(dependencies: AdminOrderQueryDependencies) {
  return {
    async listAdminOrders(filters: Partial<AdminOrderFilters> = {}) {
      await dependencies.requireAdmin()
      return dependencies.repository.listOrders(normalizeFilters(filters))
    },

    async listAdminOrderExports(filters: Partial<AdminOrderFilters> = {}) {
      await dependencies.requireAdmin()
      return dependencies.repository.listOrderExports(normalizeFilters(filters))
    },

    async getAdminOrder(orderNumber: string) {
      await dependencies.requireAdmin()
      const canonicalOrderNumber = orderNumber.trim()
      if (!canonicalOrderNumber) return null
      return dependencies.repository.getOrder(canonicalOrderNumber)
    },

    async listAdminPaymentReviews() {
      await dependencies.requireAdmin()
      return dependencies.repository.listPaymentAttemptsRequiringReview()
    },

    async getAdminPaymentReview(attemptId: string) {
      await dependencies.requireAdmin()
      const id = orderIdSchema.safeParse(attemptId)
      if (!id.success) return null
      return dependencies.repository.getPaymentAttemptForReview(id.data)
    },
  }
}

type AdminOrderDependencies = {
  repository: AdminOrderRepository
  requireAdmin: () => Promise<unknown>
  now?: () => Date
  onChanged?: (orderId: string) => void | Promise<void>
  /** Fires only after a status change actually landed, with the new status. */
  onTransition?: (orderId: string, nextStatus: OrderStatus) => void | Promise<void>
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return ''
}

export function createAdminOrderActions(dependencies: AdminOrderDependencies) {
  return {
    async replyToCustomer(orderId: string, reply: string) {
      await dependencies.requireAdmin()
      const id = orderIdSchema.safeParse(orderId)
      const message = z.string().trim().min(1, '請輸入回覆內容').max(1000, '回覆內容最多 1000 個字').safeParse(reply)
      if (!id.success) return { ok: false, message: '訂單不存在' }
      if (!message.success) return { ok: false, message: message.error.issues[0]?.message ?? '請檢查回覆內容' }
      await dependencies.repository.saveMerchantReply(id.data, message.data)
      await dependencies.onChanged?.(id.data)
      return { ok: true, message: '回覆已儲存，顧客可在訂單內容中查看' }
    },
    async updateOrderStatus(orderId: string, nextStatus: OrderStatus) {
      await dependencies.requireAdmin()
      const id = orderIdSchema.safeParse(orderId)
      const next = orderStatusSchema.safeParse(nextStatus)
      if (!id.success || !next.success) throw new Error('訂單不存在')

      const currentStatus = await dependencies.repository.getOrderStatus(id.data)
      if (!currentStatus) throw new Error('訂單不存在')
      if (!canTransitionOrder(currentStatus, next.data)) {
        throw new Error('無法變更為此狀態')
      }

      try {
        await dependencies.repository.transitionOrder(
          id.data,
          currentStatus,
          next.data,
          (dependencies.now?.() ?? new Date()).toISOString(),
        )
      } catch (error) {
        if (errorMessage(error).includes('order_status_changed')) {
          throw new Error('訂單狀態已變更，請重新整理後再試')
        }
        throw error
      }
      await dependencies.onTransition?.(id.data, next.data)
      await dependencies.onChanged?.(id.data)
    },
  }
}

function createSupabaseOrderRepository(): AdminOrderRepository {
  async function client() {
    const { createClient } = await import('@/lib/supabase/server')
    return createClient()
  }

  return {
    async getOrderStatus(orderId) {
      const supabase = await client()
      const { data, error } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .maybeSingle()
      if (error) throw error
      return data?.status ?? null
    },

    async transitionOrder(orderId, expectedStatus, nextStatus, updatedAt) {
      const supabase = await client()
      const { error } = await supabase.rpc('admin_update_order_status', {
        p_order_id: orderId,
        p_expected_status: expectedStatus,
        p_next_status: nextStatus,
        p_updated_at: updatedAt,
      })
      if (error) throw error
    },

    async saveMerchantReply(orderId, reply) {
      const { error } = await (await client())
        .from('orders')
        .update({ merchant_reply: reply, updated_at: new Date().toISOString() })
        .eq('id', orderId)
      if (error) throw error
    },
  }
}

type AdminOrderRow = {
  id: string
  order_number: string
  recipient_name: string
  recipient_phone: string
  email: string
  store_chain: string
  store_id: string
  store_name: string
  customer_note: string
  merchant_reply: string
  payment_method: string
  bank_transfer_last_five: string | null
  bank_transfer_submitted_at: string | null
  subtotal: number
  shipping_fee: number
  total: number
  status: OrderStatus
  created_at: string
  order_items?: Array<{
    id: string
    product_name: string
    sku: string
    color: string
    size: string
    unit_price: number
    quantity: number
  }> | null
  payment_attempts?: {
    status: string
    provider_reference: string | null
    paid_at: string | null
  } | Array<{
    status: string
    provider_reference: string | null
    paid_at: string | null
  }> | null
}

type AdminPaymentReviewRow = {
  id: string
  email: string
  recipient_name: string
  recipient_phone: string
  provider_reference: string | null
  review_code: string | null
  review_reason: string | null
  store_chain: string
  store_id: string
  store_name: string
  subtotal: number
  shipping_fee: number
  total: number
  items: Json
  created_at: string
}

function toPaymentReviewSummary(payment: AdminPaymentReviewRow): AdminPaymentReviewSummary {
  return {
    id: payment.id,
    email: payment.email,
    recipientName: payment.recipient_name,
    total: payment.total,
    reviewCode: payment.review_code ?? 'payment_review_required',
    reviewReason: payment.review_reason ?? '商品資料或庫存已變更',
    createdAt: payment.created_at,
  }
}

function paymentReviewItems(value: Json): AdminPaymentReviewDetail['items'] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const item = entry as Record<string, unknown>
    if (typeof item.variant_id !== 'string'
      || typeof item.product_name !== 'string'
      || typeof item.sku !== 'string'
      || typeof item.color !== 'string'
      || typeof item.size !== 'string'
      || !Number.isInteger(item.unit_price)
      || !Number.isInteger(item.quantity)) return []
    return [{
      variantId: item.variant_id,
      productName: item.product_name,
      sku: item.sku,
      color: item.color,
      size: item.size,
      unitPrice: item.unit_price as number,
      quantity: item.quantity as number,
    }]
  })
}

function toOrderSummary(order: AdminOrderRow): AdminOrderSummary {
  return {
    id: order.id,
    orderNumber: order.order_number,
    recipientName: order.recipient_name,
    email: order.email,
    total: order.total,
    status: order.status,
    createdAt: order.created_at,
  }
}

function createSupabaseOrderQueryRepository(): AdminOrderQueryRepository {
  async function client() {
    const { createClient } = await import('@/lib/supabase/server')
    return createClient()
  }

  return {
    async listOrders(filters) {
      let query = (await client())
        .from('orders')
        .select('id, order_number, recipient_name, recipient_phone, email, store_chain, store_id, store_name, customer_note, merchant_reply, payment_method, bank_transfer_last_five, bank_transfer_submitted_at, subtotal, shipping_fee, total, status, created_at')
        .order('created_at', { ascending: false })
      if (filters.query) {
        const term = filters.query.replace(/[,()]/g, ' ')
        query = query.or(`order_number.ilike.%${term}%,recipient_name.ilike.%${term}%,email.ilike.%${term}%`)
      }
      if (filters.status) query = query.eq('status', filters.status)
      const { data, error } = await query
      if (error) throw error
      return ((data ?? []) as AdminOrderRow[]).map(toOrderSummary)
    },

    async listOrderExports(filters) {
      let query = (await client())
        .from('orders')
        .select(`
          id, order_number, recipient_name, recipient_phone, email,
          store_chain, store_id, store_name, customer_note, merchant_reply, payment_method, bank_transfer_last_five, bank_transfer_submitted_at, subtotal, shipping_fee, total, status, created_at,
          order_items(id, product_name, sku, color, size, unit_price, quantity)
        `)
        .order('created_at', { ascending: false })
        .limit(1000)
      if (filters.query) {
        const term = filters.query.replace(/[,()]/g, ' ')
        query = query.or(`order_number.ilike.%${term}%,recipient_name.ilike.%${term}%,email.ilike.%${term}%`)
      }
      if (filters.status) query = query.eq('status', filters.status)
      const { data, error } = await query
      if (error) throw error
      return ((data ?? []) as unknown as AdminOrderRow[]).map((order) => ({
        ...toOrderSummary(order),
        recipientPhone: order.recipient_phone,
        storeChain: order.store_chain,
        storeId: order.store_id,
        storeName: order.store_name,
        customerNote: order.customer_note,
        merchantReply: order.merchant_reply,
        paymentMethod: order.payment_method,
        bankTransferLastFive: order.bank_transfer_last_five,
        bankTransferSubmittedAt: order.bank_transfer_submitted_at,
        subtotal: order.subtotal,
        shippingFee: order.shipping_fee,
        items: (order.order_items ?? []).map((item) => ({
          id: item.id,
          productName: item.product_name,
          sku: item.sku,
          color: item.color,
          size: item.size,
          unitPrice: item.unit_price,
          quantity: item.quantity,
        })),
        payment: null,
      }))
    },

    async getOrder(orderNumber) {
      const { data, error } = await (await client())
        .from('orders')
        .select(`
          id, order_number, recipient_name, recipient_phone, email,
          store_chain, store_id, store_name, customer_note, merchant_reply, payment_method, bank_transfer_last_five, bank_transfer_submitted_at, subtotal, shipping_fee, total, status, created_at,
          order_items(id, product_name, sku, color, size, unit_price, quantity),
          payment_attempts(status, provider_reference, paid_at)
        `)
        .eq('order_number', orderNumber)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const order = data as unknown as AdminOrderRow
      const payment = Array.isArray(order.payment_attempts)
        ? order.payment_attempts[0]
        : order.payment_attempts
      return {
        ...toOrderSummary(order),
        recipientPhone: order.recipient_phone,
        storeChain: order.store_chain,
        storeId: order.store_id,
        storeName: order.store_name,
        customerNote: order.customer_note,
        merchantReply: order.merchant_reply,
        paymentMethod: order.payment_method,
        bankTransferLastFive: order.bank_transfer_last_five,
        bankTransferSubmittedAt: order.bank_transfer_submitted_at,
        subtotal: order.subtotal,
        shippingFee: order.shipping_fee,
        items: (order.order_items ?? []).map((item) => ({
          id: item.id,
          productName: item.product_name,
          sku: item.sku,
          color: item.color,
          size: item.size,
          unitPrice: item.unit_price,
          quantity: item.quantity,
        })),
        payment: payment ? {
          status: payment.status,
          providerReference: payment.provider_reference,
          paidAt: payment.paid_at,
        } : null,
      }
    },

    async listPaymentAttemptsRequiringReview() {
      const { data, error } = await (await client())
        .from('payment_attempts')
        .select(`
          id, email, recipient_name, recipient_phone, provider_reference,
          review_code, review_reason, store_chain, store_id, store_name,
          subtotal, shipping_fee, total, items, created_at
        `)
        .eq('status', 'requires_review')
        .order('created_at', { ascending: false })
      if (error) throw error
      return ((data ?? []) as AdminPaymentReviewRow[]).map(toPaymentReviewSummary)
    },

    async getPaymentAttemptForReview(attemptId) {
      const { data, error } = await (await client())
        .from('payment_attempts')
        .select(`
          id, email, recipient_name, recipient_phone, provider_reference,
          review_code, review_reason, store_chain, store_id, store_name,
          subtotal, shipping_fee, total, items, created_at
        `)
        .eq('id', attemptId)
        .eq('status', 'requires_review')
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const payment = data as AdminPaymentReviewRow
      return {
        ...toPaymentReviewSummary(payment),
        recipientPhone: payment.recipient_phone,
        providerReference: payment.provider_reference,
        storeChain: payment.store_chain,
        storeId: payment.store_id,
        storeName: payment.store_name,
        subtotal: payment.subtotal,
        shippingFee: payment.shipping_fee,
        items: paymentReviewItems(payment.items),
      }
    },
  }
}

async function createFixtureOrderRepository() {
  const [{ createE2EOrderRepository }, { getE2EStore }] = await Promise.all([
    import('@/testing/e2e-order-repository'),
    import('@/testing/e2e-store'),
  ])
  return createE2EOrderRepository(getE2EStore())
}

// Loads just enough of the order to write the shipping mail. Kept next to the
// transition hook so the admin flow has one obvious place to look.
async function notifyOrderShipped(orderId: string) {
  const { isE2EMode } = await import('@/testing/e2e-mode')
  if (isE2EMode()) return

  // Session client, like every other admin read here: requireAdmin() has already
  // run, so RLS lets the owner read their own order and the service-role key
  // never enters this path.
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('order_number, email, recipient_name, store_chain, store_id, store_name, order_items(quantity)')
    .eq('id', orderId)
    .maybeSingle()
  if (error || !data?.email) return

  const items = (data.order_items ?? []) as Array<{ quantity: number }>
  const { sendOrderShippedEmail } = await import('@/lib/email/order-shipped')
  await sendOrderShippedEmail({
    orderNumber: String(data.order_number),
    email: String(data.email),
    recipientName: data.recipient_name ? String(data.recipient_name) : undefined,
    storeChain: data.store_chain ? String(data.store_chain) : undefined,
    storeName: data.store_name ? String(data.store_name) : undefined,
    storeId: data.store_id ? String(data.store_id) : undefined,
    itemCount: items.reduce((total, item) => total + Number(item.quantity ?? 0), 0) || undefined,
  })
}

async function resolvedActions() {
  const [{ requireAdmin }, { isE2EMode }] = await Promise.all([
    import('@/lib/auth/require-admin'),
    import('@/testing/e2e-mode'),
  ])
  const repository = isE2EMode()
    ? await createFixtureOrderRepository()
    : createSupabaseOrderRepository()

  return createAdminOrderActions({
    repository,
    requireAdmin,
    onChanged: async () => {
      const { revalidatePath } = await import('next/cache')
      revalidatePath('/admin')
      revalidatePath('/admin/orders')
      revalidatePath('/admin/orders/[orderNumber]', 'page')
    },
    onTransition: async (orderId, nextStatus) => {
      // Shipping is the one status the customer cannot see coming, and a missed
      // pickup deadline costs the shop the return shipping.
      if (nextStatus !== 'shipped') return
      try {
        await notifyOrderShipped(orderId)
      } catch {
        // A mail failure must never block the status change in the admin.
      }
    },
  })
}

export async function updateOrderStatus(orderId: string, nextStatus: OrderStatus) {
  'use server'
  return (await resolvedActions()).updateOrderStatus(orderId, nextStatus)
}

export async function replyToCustomer(
  orderId: string,
  _previousState: { ok: boolean; message: string },
  formData: FormData,
) {
  'use server'
  return (await resolvedActions()).replyToCustomer(orderId, String(formData.get('reply') ?? ''))
}

async function resolvedQueries() {
  const [{ requireAdmin }, { isE2EMode }] = await Promise.all([
    import('@/lib/auth/require-admin'),
    import('@/testing/e2e-mode'),
  ])
  const repository = isE2EMode()
    ? await createFixtureOrderRepository()
    : createSupabaseOrderQueryRepository()

  return createAdminOrderQueries({
    repository,
    requireAdmin,
  })
}

export async function listAdminOrders(filters: Partial<AdminOrderFilters> = {}) {
  return (await resolvedQueries()).listAdminOrders(filters)
}

export async function getAdminOrder(orderNumber: string) {
  return (await resolvedQueries()).getAdminOrder(orderNumber)
}

export async function listAdminOrderExports(filters: Partial<AdminOrderFilters> = {}) {
  return (await resolvedQueries()).listAdminOrderExports(filters)
}

export async function listAdminPaymentReviews() {
  return (await resolvedQueries()).listAdminPaymentReviews()
}

export async function getAdminPaymentReview(attemptId: string) {
  return (await resolvedQueries()).getAdminPaymentReview(attemptId)
}

export type AdminOrderListState = AdminOrderFilters & {
  orders: AdminOrderSummary[]
}
