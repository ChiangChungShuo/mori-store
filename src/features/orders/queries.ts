import type { OrderStatus, StoreChain } from '@/types/store'
import { isE2EMode } from '@/testing/e2e-mode'

export type OrderItem = {
  productName: string
  sku: string
  color: string
  size: string
  unitPrice: number
  quantity: number
}

export type OrderDetails = {
  orderNumber: string
  email: string
  recipientName: string
  recipientPhone: string
  storeChain: StoreChain
  storeId: string
  storeName: string
  customerNote: string
  merchantReply: string
  /** 7-ELEVEN 貨態查詢碼, filled in by the shop when the parcel ships. */
  trackingCode: string | null
  paymentMethod: string
  bankTransferLastFive?: string | null
  bankTransferSubmittedAt?: string | null
  subtotal: number
  shippingFee: number
  total: number
  status: OrderStatus
  createdAt: string
  items: OrderItem[]
}

export interface OrderQueriesRepository {
  listOrdersForUser(userId: string): Promise<OrderDetails[]>
  getOrderForUser(orderNumber: string, userId: string): Promise<OrderDetails | null>
  lookupGuestOrder(orderNumber: string, email: string): Promise<OrderDetails | null>
}

export function normalizeOrderEmail(email: string) {
  return email.trim().toLowerCase()
}

export function normalizeOrderNumber(orderNumber: string) {
  return orderNumber.trim().toUpperCase()
}

export function createOrderQueries(repository: OrderQueriesRepository) {
  return {
    listOrdersForUser(userId: string) {
      return repository.listOrdersForUser(userId)
    },

    getOrderForUser(orderNumber: string, userId: string) {
      return repository.getOrderForUser(orderNumber, userId)
    },

    lookupGuestOrder(orderNumber: string, email: string) {
      return repository.lookupGuestOrder(normalizeOrderNumber(orderNumber), normalizeOrderEmail(email))
    },
  }
}

type OrderRow = {
  order_number: string
  email: string
  recipient_name: string
  recipient_phone: string
  store_chain: StoreChain
  store_id: string
  store_name: string
  customer_note: string
  merchant_reply: string
  tracking_code?: string | null
  payment_method: string
  bank_transfer_last_five: string | null
  bank_transfer_submitted_at: string | null
  subtotal: number
  shipping_fee: number
  total: number
  status: OrderStatus
  created_at: string
  order_items: Array<{
    product_name: string
    sku: string
    color: string
    size: string
    unit_price: number
    quantity: number
  }> | null
}

const orderSelect = `
  order_number, email, recipient_name, recipient_phone,
  store_chain, store_id, store_name, customer_note, merchant_reply, tracking_code, payment_method, bank_transfer_last_five, bank_transfer_submitted_at, subtotal, shipping_fee, total, status, created_at,
  order_items(product_name, sku, color, size, unit_price, quantity)
`

function toOrderDetails(order: OrderRow): OrderDetails {
  return {
    orderNumber: order.order_number,
    email: order.email,
    recipientName: order.recipient_name,
    recipientPhone: order.recipient_phone,
    storeChain: order.store_chain,
    storeId: order.store_id,
    storeName: order.store_name,
    customerNote: order.customer_note,
    merchantReply: order.merchant_reply,
    trackingCode: order.tracking_code ?? null,
    paymentMethod: order.payment_method,
    bankTransferLastFive: order.bank_transfer_last_five,
    bankTransferSubmittedAt: order.bank_transfer_submitted_at,
    subtotal: order.subtotal,
    shippingFee: order.shipping_fee,
    total: order.total,
    status: order.status,
    createdAt: order.created_at,
    items: (order.order_items ?? []).map((item) => ({
      productName: item.product_name,
      sku: item.sku,
      color: item.color,
      size: item.size,
      unitPrice: item.unit_price,
      quantity: item.quantity,
    })),
  }
}

type MemberOrderRepository = Pick<OrderQueriesRepository, 'listOrdersForUser' | 'getOrderForUser'>

async function createLiveMemberOrderRepository(): Promise<MemberOrderRepository> {
  const { createClient } = await import('@/lib/supabase/server')
  const memberClient = await createClient()

  return {
    async listOrdersForUser(userId) {
      const { data, error } = await memberClient
        .from('orders')
        .select(orderSelect)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as OrderRow[] ?? []).map(toOrderDetails)
    },

    async getOrderForUser(orderNumber, userId) {
      const { data, error } = await memberClient
        .from('orders')
        .select(orderSelect)
        .eq('order_number', orderNumber)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data ? toOrderDetails(data as unknown as OrderRow) : null
    },
  }
}

async function createLiveGuestOrderRepository(): Promise<Pick<OrderQueriesRepository, 'lookupGuestOrder'>> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const adminClient = createAdminClient()

  return {
    async lookupGuestOrder(orderNumber, email) {
      const { data, error } = await adminClient
        .from('orders')
        .select(orderSelect)
        .eq('order_number', orderNumber)
        .eq('email', email)
        .maybeSingle()
      if (error) throw error
      return data ? toOrderDetails(data as unknown as OrderRow) : null
    },
  }
}

export async function listOrdersForUser(userId: string) {
  if (isE2EMode()) {
    const [{ createE2EOrderRepository }, { getE2EStore }] = await Promise.all([
      import('@/testing/e2e-order-repository'),
      import('@/testing/e2e-store'),
    ])
    return createE2EOrderRepository(getE2EStore()).listOrdersForUser(userId)
  }
  return (await createLiveMemberOrderRepository()).listOrdersForUser(userId)
}

export async function getOrderForUser(orderNumber: string, userId: string) {
  if (isE2EMode()) {
    const [{ createE2EOrderRepository }, { getE2EStore }] = await Promise.all([
      import('@/testing/e2e-order-repository'),
      import('@/testing/e2e-store'),
    ])
    return createE2EOrderRepository(getE2EStore()).getOrderForUser(orderNumber, userId)
  }
  return (await createLiveMemberOrderRepository()).getOrderForUser(orderNumber, userId)
}

export async function lookupGuestOrder(orderNumber: string, email: string) {
  if (isE2EMode()) {
    const [{ createE2EOrderRepository }, { getE2EStore }] = await Promise.all([
      import('@/testing/e2e-order-repository'),
      import('@/testing/e2e-store'),
    ])
    return createE2EOrderRepository(getE2EStore())
      .lookupGuestOrder(normalizeOrderNumber(orderNumber), normalizeOrderEmail(email))
  }
  return (await createLiveGuestOrderRepository())
    .lookupGuestOrder(normalizeOrderNumber(orderNumber), normalizeOrderEmail(email))
}
