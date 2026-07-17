import type { OrderStatus, StoreChain } from '@/types/store'

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

export function createOrderQueries(repository: OrderQueriesRepository) {
  return {
    listOrdersForUser(userId: string) {
      return repository.listOrdersForUser(userId)
    },

    getOrderForUser(orderNumber: string, userId: string) {
      return repository.getOrderForUser(orderNumber, userId)
    },

    lookupGuestOrder(orderNumber: string, email: string) {
      return repository.lookupGuestOrder(orderNumber, normalizeOrderEmail(email))
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
  store_chain, store_id, store_name, subtotal, shipping_fee, total, status, created_at,
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
        .is('user_id', null)
        .maybeSingle()
      if (error) throw error
      return data ? toOrderDetails(data as unknown as OrderRow) : null
    },
  }
}

export async function listOrdersForUser(userId: string) {
  return (await createLiveMemberOrderRepository()).listOrdersForUser(userId)
}

export async function getOrderForUser(orderNumber: string, userId: string) {
  return (await createLiveMemberOrderRepository()).getOrderForUser(orderNumber, userId)
}

export async function lookupGuestOrder(orderNumber: string, email: string) {
  return (await createLiveGuestOrderRepository())
    .lookupGuestOrder(orderNumber, normalizeOrderEmail(email))
}
