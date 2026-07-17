import { redirect } from 'next/navigation'
import { CheckoutForm } from '@/features/checkout/checkout-form'
import { createPaymentAttempt } from '@/features/checkout/service'
import {
  CheckoutAttemptError,
  toCheckoutActionState,
  type CheckoutActionState,
  type CheckoutCartItem,
} from '@/features/checkout/types'

type CheckoutPageProps = {
  searchParams: Promise<{ payment?: string }>
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const { payment } = await searchParams

  async function beginCheckout(
    _previousState: CheckoutActionState,
    formData: FormData,
  ): Promise<CheckoutActionState> {
    'use server'

    let cart: CheckoutCartItem[] = []
    try {
      cart = JSON.parse(formData.get('cart')?.toString() ?? '[]') as CheckoutCartItem[]
    } catch {
      return toCheckoutActionState(new CheckoutAttemptError('cart_invalid'))
    }

    let attemptId: string
    try {
      const attempt = await createPaymentAttempt({
        email: formData.get('email')?.toString() ?? '',
        recipientName: formData.get('recipientName')?.toString() ?? '',
        phone: formData.get('phone')?.toString() ?? '',
        chain: formData.get('chain')?.toString() as 'seven_eleven' | 'family_mart',
        storeId: formData.get('storeId')?.toString() ?? '',
      }, cart)
      attemptId = attempt.attemptId
    } catch (error) {
      return toCheckoutActionState(error)
    }

    redirect(`/checkout/payment/${attemptId}`)
  }

  return (
    <main className="section checkout-page">
      <header className="page-heading">
        <p>checkout</p>
        <h1>結帳</h1>
      </header>
      {payment === 'failure' ? <p role="alert">付款失敗，購物袋已保留，請重新結帳。</p> : null}
      {payment === 'cancelled' ? <p role="alert">付款已取消，購物袋已保留。</p> : null}
      <CheckoutForm action={beginCheckout} />
    </main>
  )
}
