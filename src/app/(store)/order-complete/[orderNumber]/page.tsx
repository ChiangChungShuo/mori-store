import { notFound } from 'next/navigation'
import { getCompletedOrder } from '@/features/checkout/service'

type OrderCompletePageProps = {
  params: Promise<{ orderNumber: string }>
}

export default async function OrderCompletePage({ params }: OrderCompletePageProps) {
  const { orderNumber } = await params
  const order = await getCompletedOrder(orderNumber)
  if (!order) notFound()

  return (
    <main className="section order-complete-page">
      <header className="page-heading">
        <p>thank you</p>
        <h1>訂單完成</h1>
      </header>
      <dl className="order-result">
        <div><dt>訂單編號</dt><dd>{order.order_number}</dd></div>
        <div><dt>付款結果</dt><dd>付款成功</dd></div>
        <div>
          <dt>取貨門市</dt>
          <dd>{order.store_name}（{order.store_id}）</dd>
        </div>
        <div><dt>後續狀態</dt><dd>{order.status === 'paid' ? '已付款，等待備貨' : order.status}</dd></div>
      </dl>
    </main>
  )
}
