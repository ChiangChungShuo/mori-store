import Link from 'next/link'
import { listAdminOrders } from '@/features/admin/order-actions'
import type { OrderStatus } from '@/types/store'
import { formatTwd } from '@/lib/money'

export const dynamic = 'force-dynamic'

const statusLabels: Record<OrderStatus, string> = {
  pending_payment: '待付款',
  paid: '已付款',
  preparing: '備貨中',
  shipped: '已出貨',
  collected: '已取貨',
  cancelled: '已取消',
}

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] ?? '' : input ?? ''
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = value(params.q)
  const status = value(params.status)
  const orders = await listAdminOrders({ query, status: status as OrderStatus })

  return (
    <main className="section">
      <p><Link href="/admin">← 返回後台</Link></p>
      <header className="page-heading">
        <p>admin / orders</p>
        <h1>訂單管理</h1>
      </header>
      <form className="product-filters" method="get">
        <label>
          訂單編號、收件人或 Email
          <input defaultValue={query} name="q" type="search" />
        </label>
        <label>
          狀態
          <select defaultValue={status} name="status">
            <option value="">全部狀態</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <div className="filter-actions">
          <button className="button" type="submit">篩選</button>
          <Link href="/admin/orders">清除</Link>
        </div>
      </form>
      {orders.length === 0 ? (
        <p>沒有符合條件的訂單。</p>
      ) : (
        <table className="admin-product-table">
          <thead>
            <tr>
              <th scope="col">訂單編號</th>
              <th scope="col">收件人</th>
              <th scope="col">Email</th>
              <th scope="col">金額</th>
              <th scope="col">狀態</th>
              <th scope="col">成立時間</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <th scope="row"><Link href={`/admin/orders/${order.orderNumber}`}>{order.orderNumber}</Link></th>
                <td>{order.recipientName}</td>
                <td>{order.email}</td>
                <td>{formatTwd(order.total)}</td>
                <td>{statusLabels[order.status]}</td>
                <td>{new Date(order.createdAt).toLocaleString('zh-TW')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
