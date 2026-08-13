import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { CheckoutForm } from '@/features/checkout/checkout-form'
import { createPaymentAttempt } from '@/features/checkout/service'
import { validateCoupon } from '@/features/checkout/coupons'
import { CheckoutProgress } from '@/features/checkout/checkout-progress'
import { CVS_STORE_COOKIE, type PickedStore } from '@/lib/checkout/cvs-map'
import { requireUser } from '@/lib/auth/require-user'
import { getAccountSummary } from '@/features/account/summary'
import {
  CheckoutAttemptError,
  toCheckoutActionState,
  type CheckoutActionState,
  type CheckoutCartItem,
} from '@/features/checkout/types'

export const dynamic = 'force-dynamic'

type CheckoutPageProps = {
  searchParams: Promise<{ payment?: string }>
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const user = await requireUser('/checkout')
  const account = await getAccountSummary(user)
  const previousOrder = account?.orders[0]
  const initialValues = {
    email: previousOrder?.email ?? account?.email ?? '',
    recipientName: previousOrder?.recipientName ?? account?.displayName ?? '',
    phone: previousOrder?.recipientPhone ?? account?.phone ?? '',
    chain: 'seven_eleven' as const,
    storeName: previousOrder?.storeChain === 'seven_eleven' ? previousOrder.storeName : '',
    storeId: previousOrder?.storeChain === 'seven_eleven' ? previousOrder.storeId : '',
  }
  const { payment } = await searchParams

  const cookieStore = await cookies()
  let pickedStore: PickedStore | null = null
  const rawPickedStore = cookieStore.get(CVS_STORE_COOKIE)?.value
  if (rawPickedStore) {
    try {
      const parsed = JSON.parse(rawPickedStore) as PickedStore
      pickedStore = parsed.chain === 'seven_eleven' ? parsed : null
    } catch {
      pickedStore = null
    }
  }

  async function applyCoupon(code: string, subtotal: number) {
    'use server'
    return validateCoupon(code, subtotal)
  }

  async function beginCheckout(
    _previousState: CheckoutActionState,
    formData: FormData,
  ): Promise<CheckoutActionState> {
    'use server'
    await requireUser('/checkout')

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
        chain: formData.get('chain')?.toString() as 'seven_eleven',
        storeName: formData.get('storeName')?.toString() ?? '',
        storeId: formData.get('storeId')?.toString() ?? '',
        couponCode: formData.get('couponCode')?.toString() ?? '',
        customerNote: formData.get('customerNote')?.toString() ?? '',
        paymentMethod: formData.get('paymentMethod')?.toString() as 'bank_transfer',
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
        <p>checkout details</p>
        <h1>填寫資料</h1>
        <span>填寫收件人、超商門市與付款方式，下一步會先讓你確認完整訂單。</span>
      </header>
      <CheckoutProgress current={2} />
      {payment === 'failure' ? <p role="alert">付款失敗，購物車已保留，請重新結帳。</p> : null}
      {payment === 'cancelled' ? <p role="alert">付款已取消，購物車已保留。</p> : null}
      <CheckoutForm action={beginCheckout} couponAction={applyCoupon} initialValues={initialValues} pickedStore={pickedStore} />
    </main>
  )
}
