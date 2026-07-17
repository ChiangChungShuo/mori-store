import Link from 'next/link'
import { notFound } from 'next/navigation'
import { canTransitionOrder } from '@/features/orders/status'
import { getAdminOrder, updateOrderStatus } from '@/features/admin/order-actions'
import { formatTwd } from '@/lib/money'
import { formatTaipeiDateTime } from '@/lib/date-time'
import type { OrderStatus } from '@/types/store'

export const dynamic = 'force-dynamic'

const statusLabels: Record<OrderStatus, string> = {
  pending_payment: '待付款',
  paid: '已付款',
  preparing: '備貨中',
  shipped: '已出貨',
  collected: '已取貨',
  cancelled: '已取消',
}

const statusActions: Array<{ status: OrderStatus; label: string }> = [
  { status: 'paid', label: '標記已付款' },
  { status: 'preparing', label: '開始備貨' },
  { status: 'shipped', label: '標記已出貨' },
  { status: 'collected', label: '標記已取貨' },
  { status: 'cancelled', label: '取消訂單' },
]

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}) {
  const { orderNumber } = await params
  const order = await getAdminOrder(decodeURIComponent(orderNumber))
  if (!order) notFound()

  return (
    <main className="section">
      <p><Link href="/admin/orders">← 返回訂單列表</Link></p>
      <header className="page-heading">
        <p>admin / orders / detail</p>
        <h1>{order.orderNumber}</h1>
      </header>
      <p><strong>目前狀態：{statusLabels[order.status]}</strong></p>
      <p>成立時間：{formatTaipeiDateTime(order.createdAt)}</p>
      <div className="payment-actions">
        {statusActions.filter(({ status }) => canTransitionOrder(order.status, status)).map(({ status, label }) => (
          <form action={updateOrderStatus.bind(null, order.id, status)} key={status}>
            <button className="button" type="submit">{label}</button>
          </form>
        ))}
      </div>

      <section>
        <h2>收件人</h2>
        <dl className="order-result">
          <div><dt>姓名</dt><dd>{order.recipientName}</dd></div>
          <div><dt>電話</dt><dd>{order.recipientPhone}</dd></div>
          <div><dt>Email</dt><dd>{order.email}</dd></div>
        </dl>
      </section>

      <section>
        <h2>取貨門市</h2>
        <dl className="order-result">
          <div><dt>通路</dt><dd>{order.storeChain}</dd></div>
          <div><dt>門市</dt><dd>{order.storeName}（{order.storeId}）</dd></div>
        </dl>
      </section>

      <section>
        <h2>訂購商品</h2>
        <table className="admin-product-table">
          <thead>
            <tr>
              <th scope="col">商品</th>
              <th scope="col">規格</th>
              <th scope="col">單價</th>
              <th scope="col">數量</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <th scope="row">{item.productName}</th>
                <td>{item.color}／{item.size}／{item.sku}</td>
                <td>{formatTwd(item.unitPrice)}</td>
                <td>{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="order-result">
          <div><dt>商品小計</dt><dd>{formatTwd(order.subtotal)}</dd></div>
          <div><dt>運費</dt><dd>{formatTwd(order.shippingFee)}</dd></div>
          <div><dt>訂單總計</dt><dd>{formatTwd(order.total)}</dd></div>
        </dl>
      </section>

      <section>
        <h2>測試付款</h2>
        {order.payment ? (
          <dl className="order-result">
            <div><dt>付款狀態</dt><dd>{order.payment.status}</dd></div>
            <div><dt>交易代碼</dt><dd>{order.payment.providerReference ?? '—'}</dd></div>
            <div><dt>付款時間</dt><dd>{order.payment.paidAt ? formatTaipeiDateTime(order.payment.paidAt) : '—'}</dd></div>
          </dl>
        ) : <p>沒有測試付款紀錄。</p>}
      </section>
    </main>
  )
}
