import Link from 'next/link'
import { listAdminOrders, listAdminPaymentReviews } from '@/features/admin/order-actions'
import { AdminOrderList } from '@/features/admin/order-list'

export const dynamic = 'force-dynamic'

export default async function AdminOrdersPage() {
  const [orders, reviews] = await Promise.all([
    listAdminOrders(),
    listAdminPaymentReviews(),
  ])

  return (
    <main className="section admin-management-page">
      <p><Link href="/admin">← 返回後台</Link></p>
      <header className="admin-page-heading">
        <div><p className="eyebrow">admin / orders</p><h1>訂單管理</h1></div>
        <div className="admin-page-actions">
          <a className="admin-inline-action" download href="/admin/orders/export">匯出 CSV</a>
        </div>
      </header>
      <p className="admin-page-lead">查詢與篩選訂單、確認匯款末五碼，並處理需要人工確認的付款。列表可直接把訂單推進到下一個階段。</p>
      <AdminOrderList initialState={{ orders, query: '', status: '' }} reviews={reviews} />
    </main>
  )
}
