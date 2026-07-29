import type { OrderStatus } from '@/types/store'

export type StorefrontEvent = {
  sessionId: string
  type: 'page_view' | 'product_view' | 'add_to_cart' | 'checkout_started' | 'purchase' | 'search'
  productName: string | null
  path: string
  searchQuery?: string | null
  resultCount?: number | null
  createdAt?: string
}

type InsightOrder = {
  status: OrderStatus
  total: number
  items: Array<{ productName: string; quantity: number }>
}

export function calculateCommerceInsights({
  orders,
  events,
}: {
  orders: InsightOrder[]
  events: StorefrontEvent[]
}) {
  const completedOrders = orders.filter((order) => order.status !== 'cancelled' && order.status !== 'pending_payment')
  const salesRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0)
  const addedSessions = new Set(events.filter((event) => event.type === 'add_to_cart').map((event) => event.sessionId))
  const purchasedSessions = new Set(events.filter((event) => event.type === 'purchase').map((event) => event.sessionId))
  const abandonedSessions = [...addedSessions].filter((sessionId) => !purchasedSessions.has(sessionId)).length
  const products = new Map<string, number>()
  const pageViews = events.filter((event) => event.type === 'page_view')
  const sessionIds = new Set(events.map((event) => event.sessionId))
  const productViewSessions = new Set(events.filter((event) => event.type === 'product_view').map((event) => event.sessionId))
  const checkoutSessions = new Set(events.filter((event) => event.type === 'checkout_started').map((event) => event.sessionId))
  const pageViewDates = new Map<string, number>()
  const pageViewPaths = new Map<string, number>()
  const searches = new Map<string, { count: number; zeroResults: number; sessions: Set<string> }>()

  for (const event of pageViews) {
    pageViewPaths.set(event.path, (pageViewPaths.get(event.path) ?? 0) + 1)
    if (event.createdAt) {
      const date = event.createdAt.slice(0, 10)
      pageViewDates.set(date, (pageViewDates.get(date) ?? 0) + 1)
    }
  }

  for (const event of events.filter((item) => item.type === 'search' && item.searchQuery)) {
    const query = event.searchQuery!.trim()
    if (!query) continue
    const current = searches.get(query) ?? { count: 0, zeroResults: 0, sessions: new Set<string>() }
    current.count += 1
    if (event.resultCount === 0) current.zeroResults += 1
    current.sessions.add(event.sessionId)
    searches.set(query, current)
  }

  for (const order of completedOrders) {
    for (const item of order.items) {
      products.set(item.productName, (products.get(item.productName) ?? 0) + item.quantity)
    }
  }

  const funnelBase = productViewSessions.size
  const funnel = [
    { key: 'product_view', label: '瀏覽商品', sessions: productViewSessions.size },
    { key: 'add_to_cart', label: '加入購物車', sessions: addedSessions.size },
    { key: 'checkout_started', label: '開始結帳', sessions: checkoutSessions.size },
    { key: 'purchase', label: '完成購買', sessions: purchasedSessions.size },
  ] as const

  return {
    salesRevenue,
    orderCount: completedOrders.length,
    averageOrderValue: completedOrders.length ? Math.round(salesRevenue / completedOrders.length) : 0,
    productViews: events.filter((event) => event.type === 'product_view').length,
    totalPageViews: pageViews.length,
    uniqueVisitors: sessionIds.size,
    conversionRate: sessionIds.size ? Math.round((purchasedSessions.size / sessionIds.size) * 100) : 0,
    pageViewsByDay: [...pageViewDates.entries()]
      .map(([date, views]) => ({ date, views }))
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-14),
    popularPages: [...pageViewPaths.entries()]
      .map(([path, views]) => ({ path, views }))
      .sort((left, right) => right.views - left.views)
      .slice(0, 8),
    searchCount: [...searches.values()].reduce((sum, search) => sum + search.count, 0),
    zeroResultSearches: [...searches.values()].reduce((sum, search) => sum + search.zeroResults, 0),
    searchTerms: [...searches.entries()]
      .map(([query, search]) => ({
        query,
        searches: search.count,
        zeroResults: search.zeroResults,
        clickThroughRate: search.sessions.size
          ? Math.round(([...search.sessions].filter((sessionId) => productViewSessions.has(sessionId)).length / search.sessions.size) * 100)
          : 0,
      }))
      .sort((left, right) => right.searches - left.searches)
      .slice(0, 10),
    cartAbandonmentRate: addedSessions.size ? Math.round((abandonedSessions / addedSessions.size) * 100) : 0,
    purchaseFunnel: funnel.map((stage) => ({
      ...stage,
      rate: funnelBase ? Math.round((stage.sessions / funnelBase) * 100) : 0,
    })),
    popularProducts: [...products.entries()]
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 5),
  }
}
