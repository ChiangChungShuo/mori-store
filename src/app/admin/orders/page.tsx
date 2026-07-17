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
    <main className="section">
      <p><Link href="/admin">← 返回後台</Link></p>
      <header className="page-heading">
        <p>admin / orders</p>
        <h1>訂單管理</h1>
      </header>
      <AdminOrderList initialState={{ orders, query: '', status: '' }} reviews={reviews} />
    </main>
  )
}
