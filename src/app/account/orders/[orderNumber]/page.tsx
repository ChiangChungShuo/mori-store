import { notFound } from 'next/navigation'
import { OrderCard } from '@/features/orders/order-card'
import { getOrderForUser } from '@/features/orders/queries'
import { requireUser } from '@/lib/auth/require-user'
import Link from 'next/link'
import { BankTransferForm } from '@/features/orders/bank-transfer-form'
import { submitBankTransferLastFive } from '@/features/orders/bank-transfer-actions'

type OrderPageProps = {
  params: Promise<{ orderNumber: string }>
}

export default async function OrderPage({ params }: OrderPageProps) {
  const [user, { orderNumber }] = await Promise.all([requireUser(), params])
  const order = await getOrderForUser(orderNumber, user.id)
  if (!order) notFound()

  return (
    <main className="account-page">
      <p className="account-back"><Link href="/account/orders">← 返回訂單紀錄</Link></p>
      <header className="account-page-heading">
        <div><p className="eyebrow">order detail</p><h1>訂單明細</h1></div>
        <p>訂單編號 {order.orderNumber}</p>
      </header>
      <OrderCard order={order} />
      {order.paymentMethod === 'bank_transfer' && order.status === 'pending_payment' ? (
        <BankTransferForm
          action={submitBankTransferLastFive.bind(null, order.orderNumber)}
          initialValue={order.bankTransferLastFive ?? ''}
        />
      ) : null}
    </main>
  )
}
