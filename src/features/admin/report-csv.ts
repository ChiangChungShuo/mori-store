import { formatTaipeiDateTime } from '@/lib/date-time'

type SalesReport = {
  periods: Array<{ label: string; revenue: number; orders: number; averageOrderValue: number }>
  products: Array<{ name: string; quantity: number; revenue: number; cost: number; profit: number | null }>
  revenue: number
  orderCount: number
  costedRevenue: number
  cost: number
  grossProfit: number
  marginRate: number
  costCoverage: number
}

// Quote every field and double inner quotes so commas, line breaks and Chinese
// punctuation survive Excel, Numbers and Google Sheets.
function toCsvRow(values: string[]) {
  return values.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')
}

/**
 * One file with both halves of the report — the period trend and the per-product
 * breakdown — separated by a blank line, because a shop owner reconciling a month
 * wants them side by side rather than in two downloads.
 */
export function buildSalesReportCsv(report: SalesReport, options: { rangeLabel: string; generatedAt: string }) {
  const summary = [
    toCsvRow(['mori 銷售報表']),
    toCsvRow(['統計期間', options.rangeLabel]),
    toCsvRow(['匯出時間', formatTaipeiDateTime(options.generatedAt)]),
    toCsvRow(['有效營收', String(report.revenue)]),
    toCsvRow(['訂單數', String(report.orderCount)]),
    toCsvRow(['平均客單價', String(report.orderCount ? Math.round(report.revenue / report.orderCount) : 0)]),
    toCsvRow(['商品毛利（估算）', report.costedRevenue > 0 ? String(report.grossProfit) : '尚未填成本']),
    toCsvRow(['毛利率 %', report.costedRevenue > 0 ? String(report.marginRate) : '']),
    toCsvRow(['已填成本的銷售佔比 %', String(report.costCoverage)]),
  ]

  const periods = [
    toCsvRow(['期間', '營收', '訂單數', '平均客單價']),
    ...report.periods.map((period) => toCsvRow([
      period.label,
      String(period.revenue),
      String(period.orders),
      String(period.averageOrderValue),
    ])),
  ]

  const products = [
    toCsvRow(['商品', '銷售件數', '銷售金額', '成本', '毛利']),
    ...report.products.map((product) => toCsvRow([
      product.name,
      String(product.quantity),
      String(product.revenue),
      product.profit === null ? '' : String(product.cost),
      product.profit === null ? '尚未填成本' : String(product.profit),
    ])),
  ]

  // The BOM makes Excel read the file as UTF-8 instead of Big5.
  return `﻿${[...summary, '', ...periods, '', ...products].join('\n')}\n`
}
