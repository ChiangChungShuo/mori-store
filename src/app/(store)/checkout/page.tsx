import { redirect } from 'next/navigation'
import { CheckoutForm } from '@/features/checkout/checkout-form'
import { createPaymentAttempt } from '@/features/checkout/service'
import type { CheckoutCartItem } from '@/features/checkout/types'

type CheckoutPageProps = {
  searchParams: Promise<{ payment?: string }>
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const { payment } = await searchParams

  async function beginCheckout(formData: FormData) {
    'use server'

    let cart: CheckoutCartItem[] = []
    try {
      cart = JSON.parse(formData.get('cart')?.toString() ?? '[]') as CheckoutCartItem[]
    } catch {
      throw new Error('購物袋內容無效')
    }

    const { attemptId } = await createPaymentAttempt({
      email: formData.get('email')?.toString() ?? '',
      recipientName: formData.get('recipientName')?.toString() ?? '',
      phone: formData.get('phone')?.toString() ?? '',
      chain: formData.get('chain')?.toString() as 'seven_eleven' | 'family_mart',
      storeId: formData.get('storeId')?.toString() ?? '',
      storeName: formData.get('storeName')?.toString() ?? '',
    }, cart)

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
