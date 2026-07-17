import Link from 'next/link'
import { OrderCard } from '@/features/orders/order-card'
import { listOrdersForUser } from '@/features/orders/queries'
import { requireUser } from '@/lib/auth/require-user'

export default async function OrdersPage() {
  const user = await requireUser()
  const orders = await listOrdersForUser(user.id)

  return (
    <main className="section">
      <header className="page-heading">
        <p>orders</p>
        <h1>我的訂單</h1>
      </header>
      {orders.length === 0 ? <p>目前沒有訂單。</p> : (
        <div className="order-list">
          {orders.map((order) => (
            <div key={order.orderNumber}>
              <OrderCard order={order} />
              <Link href={`/account/orders/${order.orderNumber}`}>查看訂單明細</Link>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
