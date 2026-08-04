import { listAdminOrderExports } from '@/features/admin/order-actions'
import { buildOrdersCsv } from '@/features/admin/orders-csv'
import { orderStatusLabels } from '@/features/orders/status'
import type { OrderStatus } from '@/types/store'

export const dynamic = 'force-dynamic'

// Order export for bookkeeping and for pasting into 賣貨便. The same query and
// status filters as the list are accepted, so 匯出 CSV can follow a filter.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const query = url.searchParams.get('query')?.trim() ?? ''
  const requestedStatus = url.searchParams.get('status') ?? ''
  const status = Object.keys(orderStatusLabels).includes(requestedStatus)
    ? requestedStatus as OrderStatus
    : ''

  // listAdminOrderExports calls requireAdmin, so a non-admin request throws
  // before any order data is read.
  const orders = await listAdminOrderExports({ query, status })
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  return new Response(buildOrdersCsv(orders), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="mori-orders-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
