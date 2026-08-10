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
      products: [{ name: '有機棉小樹 T 恤', quantity: 1, revenue: 680, cost: 0, profit: null }],
      revenue: 740,
      orderCount: 1,
      costedRevenue: 0,
      cost: 0,
      grossProfit: 0,
      marginRate: 0,
      costCoverage: 0,
    })
  })

  it('groups the same data by month', () => {
    expect(calculateSalesReport(orders, 'month').periods).toEqual([
      { label: '2026-07', revenue: 740, orders: 1, averageOrderValue: 740 },
    ])
  })

  it('keeps only the orders inside the selected window', () => {
    const since = new Date('2026-07-19T00:00:00.000Z')
    const older = {
      ...orders[0],
      createdAt: '2026-07-01T10:00:00.000Z',
    }

    const report = calculateSalesReport([...orders, older], 'day', { since })

    expect(report.orderCount).toBe(1)
    expect(report.periods.map((period) => period.label)).toEqual(['2026-07-20'])
  })

  it('estimates gross margin from the variants that have a cost on file', () => {
    const mixed = [
      orders[0],
      {
        status: 'paid' as const,
        total: 980,
        createdAt: '2026-07-20T03:00:00.000Z',
        items: [{
          id: '3', variantId: 'no-cost', productName: '花野洋裝', sku: 'DRESS-100',
          color: '綠', size: '100', unitPrice: 980, quantity: 1,
        }],
      },
    ]

    const report = calculateSalesReport(mixed, 'day', { costs: new Map([['1', 280]]) })

    // Only the costed line counts towards the margin, and the panel can say so.
    expect(report).toMatchObject({
      costedRevenue: 680,
      cost: 280,
      grossProfit: 400,
      marginRate: 59,
      costCoverage: 50,
    })
    expect(report.products.find((product) => product.name === '有機棉小樹 T 恤')?.profit).toBe(400)
    expect(report.products.find((product) => product.name === '花野洋裝')?.profit).toBeNull()
  })

  it('ignores a zero cost rather than reporting a 100% margin', () => {
    const report = calculateSalesReport([orders[0]], 'day', { costs: new Map([['1', 0]]) })

    expect(report.costedRevenue).toBe(0)
    expect(report.marginRate).toBe(0)
    expect(report.costCoverage).toBe(0)
  })
})
