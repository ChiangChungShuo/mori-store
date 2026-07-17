import { TestPayment } from '@/features/checkout/test-payment-panel'

type TestPaymentPageProps = {
  params: Promise<{ attemptId: string }>
}

export default async function TestPaymentPage({ params }: TestPaymentPageProps) {
  const { attemptId } = await params

  return (
    <main className="section payment-page">
      <header className="page-heading">
        <p>test payment</p>
        <h1>測試付款</h1>
      </header>
      <TestPayment attemptId={attemptId} />
    </main>
  )
}
