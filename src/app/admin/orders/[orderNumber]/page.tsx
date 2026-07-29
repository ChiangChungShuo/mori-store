import Link from 'next/link'
import { notFound } from 'next/navigation'
import { canTransitionOrder, getOrderJourney, orderJourneySteps, orderStatusLabels } from '@/features/orders/status'
import { getAdminOrder, replyToCustomer, updateOrderStatus } from '@/features/admin/order-actions'
import { OrderReplyForm } from '@/features/admin/order-reply-form'
import { formatTwd } from '@/lib/money'
import { formatTaipeiDateTime } from '@/lib/date-time'
import type { OrderStatus } from '@/types/store'

export const dynamic = 'force-dynamic'

const statusActions: Array<{ status: OrderStatus; label: string }> = [
  { status: 'paid', label: '標記已付款' },
  { status: 'preparing', label: '開始備貨' },
  { status: 'shipped', label: '標記已出貨' },
  { status: 'collected', label: '標記已取貨' },
  { status: 'cancelled', label: '取消訂單' },
]

const storeChainLabels: Record<string, string> = {
  seven_eleven: '7-ELEVEN',
  family_mart: '全家',
}

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}) {
  const { orderNumber } = await params
  const order = await getAdminOrder(decodeURIComponent(orderNumber))
  if (!order) notFound()
  const journey = getOrderJourney(order.status, order.createdAt)

  return (
    <main className="section admin-order-detail">
      <p className="admin-back-link"><Link href="/admin/orders">← 返回訂單列表</Link></p>
      <header className="admin-page-heading">
        <div><p className="eyebrow">order detail</p><h1>{order.orderNumber}</h1></div>
        <div className="admin-order-heading-meta"><span className="status-badge" data-status={order.status}>{orderStatusLabels[order.status]}</span><small>{formatTaipeiDateTime(order.createdAt)}</small></div>
      </header>

      <section className="admin-panel admin-fulfillment-card">
        <header><div><p className="eyebrow">fulfillment</p><h2>出貨流程</h2></div><strong>{journey.estimatedArrival}</strong></header>
        {order.status !== 'cancelled' ? <ol className="admin-order-journey">
          {orderJourneySteps.map((step, index) => <li data-complete={index <= journey.activeStep} data-current={index === journey.activeStep} key={step}><span>{index < journey.activeStep ? '✓' : index + 1}</span><strong>{step}</strong></li>)}
        </ol> : <p className="order-cancelled">此訂單已取消。</p>}
        <div className="payment-actions">
          {statusActions.filter(({ status }) => canTransitionOrder(order.status, status)).map(({ status, label }) => (
            <form action={updateOrderStatus.bind(null, order.id, status)} key={status}>
              <button className={status === 'cancelled' ? 'button button-secondary' : 'button'} type="submit">{label}</button>
            </form>
          ))}
        </div>
      </section>

      <div className="admin-detail-grid">
      <section className="admin-panel">
        <h2>收件人與取貨門市</h2>
        <dl className="order-result">
          <div><dt>姓名</dt><dd>{order.recipientName}</dd></div>
          <div><dt>電話</dt><dd>{order.recipientPhone}</dd></div>
          <div><dt>Email</dt><dd>{order.email}</dd></div>
          <div><dt>通路</dt><dd>{storeChainLabels[order.storeChain] ?? order.storeChain}</dd></div>
          <div><dt>門市</dt><dd>{order.storeName}（{order.storeId}）</dd></div>
          <div><dt>買家留言</dt><dd>{order.customerNote || '沒有留言'}</dd></div>
        </dl>
      </section>

      <section className="admin-panel">
        <h2>付款資訊</h2>
        {order.payment ? (
          <dl className="order-result">
            <div><dt>付款方式</dt><dd>{order.paymentMethod === 'bank_transfer' ? '銀行匯款' : '超商取貨付款'}</dd></div>
            {order.paymentMethod === 'bank_transfer' ? <>
              <div><dt>帳號末 5 碼</dt><dd>{order.bankTransferLastFive ?? '尚未填寫'}</dd></div>
              <div><dt>回報時間</dt><dd>{order.bankTransferSubmittedAt ? formatTaipeiDateTime(order.bankTransferSubmittedAt) : '—'}</dd></div>
            </> : <div><dt>付款狀態</dt><dd>取貨時付款</dd></div>}
          </dl>
        ) : <p>沒有付款紀錄。</p>}
      </section>
      </div>

      <section className="admin-panel admin-customer-service-panel">
        <header><div><p className="eyebrow">customer service</p><h2>訂單客服留言</h2></div><span>{order.customerNote ? '買家有留言' : '尚無買家留言'}</span></header>
        <div className="admin-message-thread">
          <article><small>買家留言</small><p>{order.customerNote || '這筆訂單沒有附加問題。'}</p></article>
          {order.merchantReply ? <article data-owner="true"><small>mori 客服</small><p>{order.merchantReply}</p></article> : null}
        </div>
        <OrderReplyForm initialReply={order.merchantReply} reply={replyToCustomer.bind(null, order.id)} />
      </section>

      <section className="admin-panel admin-order-items-panel">
        <h2>訂購商品</h2>
        <div className="admin-table-scroll"><table className="admin-product-table">
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
        </table></div>
        <dl className="order-result">
          <div><dt>商品小計</dt><dd>{formatTwd(order.subtotal)}</dd></div>
          <div><dt>運費</dt><dd>{formatTwd(order.shippingFee)}</dd></div>
          <div><dt>訂單總計</dt><dd>{formatTwd(order.total)}</dd></div>
        </dl>
      </section>
    </main>
  )
}
