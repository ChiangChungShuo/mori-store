import { notFound } from 'next/navigation'
import { getAuthorizedCompletedOrder } from '@/features/checkout/service'

type OrderCompletePageProps = {
  params: Promise<{ orderNumber: string }>
  searchParams: Promise<{ attemptId?: string }>
}

export default async function OrderCompletePage({ params, searchParams }: OrderCompletePageProps) {
  const { orderNumber } = await params
  const { attemptId } = await searchParams
  if (!attemptId) notFound()

  let order
  try {
    order = await getAuthorizedCompletedOrder(attemptId, orderNumber)
  } catch {
    notFound()
  }
  if (!order) notFound()

  return (
    <main className="section order-complete-page">
      <header className="page-heading">
        <p>thank you</p>
        <h1>訂單完成</h1>
      </header>
      <dl className="order-result">
        <div><dt>訂單編號</dt><dd>{order.orderNumber}</dd></div>
        <div><dt>付款結果</dt><dd>付款成功</dd></div>
        <div>
          <dt>取貨門市</dt>
          <dd>{order.storeName}（{order.storeId}）</dd>
        </div>
        <div><dt>後續狀態</dt><dd>{order.status === 'paid' ? '已付款，等待備貨' : order.status}</dd></div>
      </dl>
    </main>
  )
}
