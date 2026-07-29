import { describe, expect, it } from 'vitest'
import { calculateCommerceInsights } from '@/features/analytics/insights'

describe('commerce analytics', () => {
  it('calculates sales, average order value, abandonment and popular products', () => {
    const result = calculateCommerceInsights({
      orders: [
        { status: 'paid', total: 740, items: [{ productName: '小樹 T 恤', quantity: 2 }] },
        { status: 'collected', total: 980, items: [{ productName: '花野洋裝', quantity: 1 }] },
        { status: 'cancelled', total: 500, items: [{ productName: '取消商品', quantity: 9 }] },
      ],
      events: [
        { sessionId: 'a', type: 'page_view', productName: null, path: '/products', createdAt: '2026-07-20T01:00:00Z' },
        { sessionId: 'a', type: 'search', productName: null, path: '/products', searchQuery: 'T 恤', resultCount: 1, createdAt: '2026-07-20T01:01:00Z' },
        { sessionId: 'a', type: 'product_view', productName: '小樹 T 恤', path: '/products/tree' },
        { sessionId: 'a', type: 'add_to_cart', productName: '小樹 T 恤', path: '/products/tree' },
        { sessionId: 'a', type: 'purchase', productName: null, path: '/order-complete/1' },
        { sessionId: 'b', type: 'page_view', productName: null, path: '/products', createdAt: '2026-07-21T01:00:00Z' },
        { sessionId: 'b', type: 'search', productName: null, path: '/products', searchQuery: '不存在', resultCount: 0, createdAt: '2026-07-21T01:01:00Z' },
        { sessionId: 'b', type: 'product_view', productName: '花野洋裝', path: '/products/dress' },
        { sessionId: 'b', type: 'add_to_cart', productName: '花野洋裝', path: '/products/dress' },
      ],
    })

    expect(result.salesRevenue).toBe(1720)
    expect(result.orderCount).toBe(2)
    expect(result.averageOrderValue).toBe(860)
    expect(result.cartAbandonmentRate).toBe(50)
    expect(result.purchaseFunnel).toEqual([
      { key: 'product_view', label: '瀏覽商品', sessions: 2, rate: 100 },
      { key: 'add_to_cart', label: '加入購物車', sessions: 2, rate: 100 },
      { key: 'checkout_started', label: '開始結帳', sessions: 0, rate: 0 },
      { key: 'purchase', label: '完成購買', sessions: 1, rate: 50 },
    ])
    expect(result.productViews).toBe(2)
    expect(result.popularProducts[0]).toEqual({ name: '小樹 T 恤', quantity: 2 })
    expect(result.totalPageViews).toBe(2)
    expect(result.uniqueVisitors).toBe(2)
    expect(result.conversionRate).toBe(50)
    expect(result.pageViewsByDay).toEqual([
      { date: '2026-07-20', views: 1 },
      { date: '2026-07-21', views: 1 },
    ])
    expect(result.searchCount).toBe(2)
    expect(result.zeroResultSearches).toBe(1)
    expect(result.searchTerms).toEqual(expect.arrayContaining([
      { query: 'T 恤', searches: 1, zeroResults: 0, clickThroughRate: 100 },
      { query: '不存在', searches: 1, zeroResults: 1, clickThroughRate: 100 },
    ]))
  })
})
