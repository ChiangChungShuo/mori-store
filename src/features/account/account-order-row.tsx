import Link from 'next/link'
import { formatTaipeiDateTime } from '@/lib/date-time'
import { formatTwd } from '@/lib/money'
import { getOrderJourney } from '@/features/orders/status'
import type { OrderDetails } from '@/features/orders/queries'

export function AccountOrderRow({ order }: { order: OrderDetails }) {
  const journey = getOrderJourney(order.status, order.createdAt)
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0)

  return (
    <article className="account-order-row">
      <div className="account-order-number">
        <span>訂單編號</span>
        <strong><Link href={`/account/orders/${order.orderNumber}`}>{order.orderNumber}</Link></strong>
        <small>{formatTaipeiDateTime(order.createdAt)}</small>
      </div>
      <div className="account-order-product">
        <strong>{order.items[0]?.productName ?? '商品資料整理中'}</strong>
        <span>{itemCount} 件商品 · {order.storeName}</span>
      </div>
      <div className="account-order-total"><span>合計</span><strong>{formatTwd(order.total)}</strong></div>
      <span className="status-badge" data-status={order.status}>{journey.label}</span>
      <Link className="account-order-link" href={`/account/orders/${order.orderNumber}`}>查看訂單</Link>
    </article>
  )
}
