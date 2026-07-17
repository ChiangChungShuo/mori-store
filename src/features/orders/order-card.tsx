import { formatTwd } from '@/lib/money'
import type { OrderDetails } from '@/features/orders/queries'

type OrderCardProps = {
  order: OrderDetails
}

export function OrderCard({ order }: OrderCardProps) {
  return (
    <article className="order-card">
      <header>
        <h2>{order.orderNumber}</h2>
        <p>訂單狀態：{order.status}</p>
      </header>
      <dl className="order-result">
        <div><dt>收件人</dt><dd>{order.recipientName}（{order.recipientPhone}）</dd></div>
        <div><dt>取貨門市</dt><dd>{order.storeName}（{order.storeId}）</dd></div>
        <div><dt>商品小計</dt><dd>{formatTwd(order.subtotal)}</dd></div>
        <div><dt>運費</dt><dd>{formatTwd(order.shippingFee)}</dd></div>
        <div><dt>訂單總計</dt><dd>{formatTwd(order.total)}</dd></div>
      </dl>
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
