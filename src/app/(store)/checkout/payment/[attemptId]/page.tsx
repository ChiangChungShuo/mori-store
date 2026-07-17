import { notFound } from 'next/navigation'
import { getAuthorizedPaymentAttempt } from '@/features/checkout/service'
import { TestPayment } from '@/features/checkout/test-payment-panel'
import { formatTwd } from '@/lib/money'

type TestPaymentPageProps = {
  params: Promise<{ attemptId: string }>
}

export default async function TestPaymentPage({ params }: TestPaymentPageProps) {
  const { attemptId } = await params
  const payment = await (async () => {
    try {
      return await getAuthorizedPaymentAttempt(attemptId)
    } catch {
      notFound()
    }
  })()

  return (
    <main className="section payment-page">
      <header className="page-heading">
        <p>test payment</p>
        <h1>測試付款</h1>
      </header>
      <section className="cart-summary" aria-label="付款訂單摘要">
        <h2>付款訂單摘要</h2>
        <ul>
          {payment.items.map((item) => (
            <li key={item.variantId}>
              <span>{item.productName}（{item.color}／{item.size}）× {item.quantity}</span>
              <strong>{formatTwd(item.unitPrice * item.quantity)}</strong>
            </li>
          ))}
        </ul>
        <p><span>商品小計</span><strong>{formatTwd(payment.subtotal)}</strong></p>
        <p><span>運費</span><strong>{payment.shippingFee === 0 ? '免運' : formatTwd(payment.shippingFee)}</strong></p>
        <p className="cart-total"><span>合計</span><strong>{formatTwd(payment.total)}</strong></p>
      </section>
      <TestPayment
        attemptId={attemptId}
        requiresReview={payment.status === 'requires_review'}
      />
    </main>
  )
}
