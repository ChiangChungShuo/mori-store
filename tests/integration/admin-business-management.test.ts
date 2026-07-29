import { describe, expect, it } from 'vitest'
import { calculateSalesReport } from '@/features/admin/business-management'

describe('admin sales reports', () => {
  const orders = [
    {
      status: 'paid' as const,
      total: 740,
      createdAt: '2026-07-19T16:30:00.000Z',
      items: [{
        id: '1', variantId: '1', productName: '有機棉小樹 T 恤', sku: 'TREE-100',
        color: '綠', size: '100', unitPrice: 680, quantity: 1,
      }],
    },
    {
      status: 'cancelled' as const,
      total: 980,
      createdAt: '2026-07-20T02:00:00.000Z',
      items: [{
        id: '2', variantId: '2', productName: '花野洋裝', sku: 'DRESS-100',
        color: '綠', size: '100', unitPrice: 980, quantity: 1,
      }],
    },
  ]

  it('groups revenue by the Taipei business day and excludes cancelled orders', () => {
    expect(calculateSalesReport(orders, 'day')).toEqual({
      periods: [{ label: '2026-07-20', revenue: 740, orders: 1, averageOrderValue: 740 }],
      products: [{ name: '有機棉小樹 T 恤', quantity: 1, revenue: 680 }],
      revenue: 740,
      orderCount: 1,
    })
  })

  it('groups the same data by month', () => {
    expect(calculateSalesReport(orders, 'month').periods).toEqual([
      { label: '2026-07', revenue: 740, orders: 1, averageOrderValue: 740 },
    ])
  })
})
