import { z } from 'zod'
import { canTransitionOrder } from '@/features/orders/status'
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

export interface AdminOrderQueryRepository {
  listOrders(filters: AdminOrderFilters): Promise<AdminOrderSummary[]>
  getOrder(orderNumber: string): Promise<AdminOrderDetail | null>
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

    async getAdminOrder(orderNumber: string) {
      await dependencies.requireAdmin()
      const canonicalOrderNumber = orderNumber.trim()
      if (!canonicalOrderNumber) return null
      return dependencies.repository.getOrder(canonicalOrderNumber)
    },
  }
}

type AdminOrderDependencies = {
  repository: AdminOrderRepository
  requireAdmin: () => Promise<unknown>
  now?: () => Date
  onChanged?: (orderId: string) => void | Promise<void>
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
        .select('id, order_number, recipient_name, recipient_phone, email, store_chain, store_id, store_name, subtotal, shipping_fee, total, status, created_at')
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

    async getOrder(orderNumber) {
      const { data, error } = await (await client())
        .from('orders')
        .select(`
          id, order_number, recipient_name, recipient_phone, email,
          store_chain, store_id, store_name, subtotal, shipping_fee, total, status, created_at,
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
  }
}

function productionActions() {
  return createAdminOrderActions({
    repository: createSupabaseOrderRepository(),
    requireAdmin: async () => {
      const { requireAdmin } = await import('@/lib/auth/require-admin')
      return requireAdmin()
    },
    onChanged: async () => {
      const { revalidatePath } = await import('next/cache')
      revalidatePath('/admin')
      revalidatePath('/admin/orders')
      revalidatePath('/admin/orders/[orderNumber]', 'page')
    },
  })
}

export async function updateOrderStatus(orderId: string, nextStatus: OrderStatus) {
  'use server'
  return productionActions().updateOrderStatus(orderId, nextStatus)
}

function productionQueries() {
  return createAdminOrderQueries({
    repository: createSupabaseOrderQueryRepository(),
    requireAdmin: async () => {
      const { requireAdmin } = await import('@/lib/auth/require-admin')
      return requireAdmin()
    },
  })
}

export async function listAdminOrders(filters: Partial<AdminOrderFilters> = {}) {
  return productionQueries().listAdminOrders(filters)
}

export async function getAdminOrder(orderNumber: string) {
  return productionQueries().getAdminOrder(orderNumber)
}

export type AdminOrderListState = AdminOrderFilters & {
  orders: AdminOrderSummary[]
}
