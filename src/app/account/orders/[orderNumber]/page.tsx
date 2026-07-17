import { notFound } from 'next/navigation'
import { OrderCard } from '@/features/orders/order-card'
import { getOrderForUser } from '@/features/orders/queries'
import { requireUser } from '@/lib/auth/require-user'

type OrderPageProps = {
  params: Promise<{ orderNumber: string }>
}

export default async function OrderPage({ params }: OrderPageProps) {
  const [user, { orderNumber }] = await Promise.all([requireUser(), params])
  const order = await getOrderForUser(orderNumber, user.id)
  if (!order) notFound()

  return (
    <main className="section">
      <header className="page-heading">
        <p>order detail</p>
        <h1>訂單明細</h1>
      </header>
      <OrderCard order={order} />
    </main>
  )
}
