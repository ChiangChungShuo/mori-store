import { calculateCommerceInsights, type StorefrontEvent } from '@/features/analytics/insights'
import type { OrderStatus } from '@/types/store'

type InsightOrderRow = {
  status: OrderStatus
  total: number
  created_at: string
  order_items: Array<{ product_name: string; quantity: number }> | null
}

type InsightEventRow = {
  session_id: string
  event_type: StorefrontEvent['type']
  product_name: string | null
  path: string
  search_query: string | null
  search_result_count: number | null
  created_at: string
}

export async function getCommerceInsights(options: { since?: Date | null } = {}) {
  const [{ requireAdmin }, { isE2EMode }] = await Promise.all([
    import('@/lib/auth/require-admin'),
    import('@/testing/e2e-mode'),
  ])
  await requireAdmin()
  const since = options.since ?? null

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const store = getE2EStore()
    return calculateCommerceInsights({
      orders: [...store.orders.values()]
        .filter((order) => !since || new Date(order.createdAt).getTime() >= since.getTime())
        .map((order) => ({
          status: order.status,
          total: order.total,
          items: order.items,
        })),
      events: store.events.filter((event) => (
        !since || !event.createdAt || new Date(event.createdAt).getTime() >= since.getTime()
      )),
    })
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const ordersQuery = supabase.from('orders').select('status, total, created_at, order_items(product_name, quantity)')
  const eventsQuery = supabase.from('storefront_events')
    .select('session_id, event_type, product_name, path, search_query, search_result_count, created_at')
    .order('created_at', { ascending: true })
    .limit(1000)
  const [ordersResult, eventsResult] = await Promise.all([
    since ? ordersQuery.gte('created_at', since.toISOString()) : ordersQuery,
    since ? eventsQuery.gte('created_at', since.toISOString()) : eventsQuery,
  ])
  if (ordersResult.error) throw ordersResult.error
  if (eventsResult.error) throw eventsResult.error

  return calculateCommerceInsights({
    orders: ((ordersResult.data ?? []) as unknown as InsightOrderRow[]).map((order) => ({
      status: order.status,
      total: order.total,
      items: (order.order_items ?? []).map((item) => ({
        productName: item.product_name,
        quantity: item.quantity,
      })),
    })),
    events: ((eventsResult.data ?? []) as unknown as InsightEventRow[]).map((event) => ({
      sessionId: event.session_id,
      type: event.event_type,
      productName: event.product_name,
      path: event.path,
      searchQuery: event.search_query,
      resultCount: event.search_result_count,
      createdAt: event.created_at,
    })),
  })
}
