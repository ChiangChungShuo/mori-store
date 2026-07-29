import { formatTwd } from '@/lib/money'
import type { OrderDetails } from '@/features/orders/queries'
import { getOrderJourney, orderJourneySteps } from '@/features/orders/status'
import { formatTaipeiDateTime } from '@/lib/date-time'

type OrderCardProps = {
  order: OrderDetails
}

export function OrderCard({ order }: OrderCardProps) {
  const journey = getOrderJourney(order.status, order.createdAt)

  return (
    <article className="order-card">
      <header className="order-card-heading">
        <div><p>訂單編號</p><h2>{order.orderNumber}</h2></div>
        <span className="status-badge" data-status={order.status}>{journey.label}</span>
      </header>
      {order.status === 'cancelled' ? (
        <p className="order-cancelled">此訂單已取消，如有付款問題請聯絡客服。</p>
      ) : (
        <section className="order-journey" aria-label="訂單進度">
          <div className="order-journey-summary">
            <div><span>目前進度</span><strong>{journey.label}</strong></div>
            <div><span>預計到貨</span><strong>{journey.estimatedArrival}</strong></div>
          </div>
          <ol>
            {orderJourneySteps.map((step, index) => (
              <li data-complete={index <= journey.activeStep} data-current={index === journey.activeStep} key={step}>
                <span aria-hidden="true">{index < journey.activeStep ? '✓' : index + 1}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
        </section>
      )}
      <dl className="order-result">
        <div><dt>成立時間</dt><dd>{formatTaipeiDateTime(order.createdAt)}</dd></div>
        <div><dt>收件人</dt><dd>{order.recipientName}（{order.recipientPhone}）</dd></div>
        <div><dt>取貨門市</dt><dd>{order.storeName}（{order.storeId}）</dd></div>
        <div><dt>付款方式</dt><dd>{order.paymentMethod === 'bank_transfer' ? '銀行匯款' : '超商取貨付款'}</dd></div>
        {order.paymentMethod === 'bank_transfer' ? <div><dt>匯款末 5 碼</dt><dd>{order.bankTransferLastFive ? `${order.bankTransferLastFive}（等待店家核對）` : '尚未填寫'}</dd></div> : null}
        <div><dt>商品小計</dt><dd>{formatTwd(order.subtotal)}</dd></div>
        <div><dt>運費</dt><dd>{formatTwd(order.shippingFee)}</dd></div>
        <div><dt>訂單總計</dt><dd>{formatTwd(order.total)}</dd></div>
      </dl>
      {order.customerNote ? <section className="order-customer-note"><strong>買家留言</strong><p>{order.customerNote}</p></section> : null}
      {order.merchantReply ? <section className="order-merchant-reply"><strong>mori 客服回覆</strong><p>{order.merchantReply}</p></section> : null}
      <ul className="order-items" aria-label="訂購商品">
        {order.items.map((item) => (
          <li key={`${item.sku}-${item.color}-${item.size}`}>
            <strong>{item.productName}</strong>
            <span>{item.color}／{item.size}／{item.sku}</span>
            <span>{formatTwd(item.unitPrice)} × {item.quantity}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}
