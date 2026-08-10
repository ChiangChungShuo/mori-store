import { getSalesReport, parseReportRange, reportRangeStart } from '@/features/admin/business-management'
import { buildSalesReportCsv } from '@/features/admin/report-csv'

export const dynamic = 'force-dynamic'

// Sales export for bookkeeping. Takes the same ?range= as the report page, so
// 匯出 CSV always matches the numbers on screen.
export async function GET(request: Request) {
  const range = parseReportRange(new URL(request.url).searchParams.get('range') ?? undefined)
  const now = new Date()

  // getSalesReport calls requireAdmin, so a non-admin request throws before any
  // order data is read.
  const report = await getSalesReport(range.period, { since: reportRangeStart(range, now) })
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '')

  return new Response(buildSalesReportCsv(report, { rangeLabel: range.label, generatedAt: now.toISOString() }), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="mori-sales-${range.key}-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
