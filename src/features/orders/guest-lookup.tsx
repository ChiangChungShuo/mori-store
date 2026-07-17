'use client'

import { useActionState } from 'react'
import { OrderCard } from '@/features/orders/order-card'
import type { OrderDetails } from '@/features/orders/queries'

export const guestLookupMissMessage = '查無訂單，請確認訂單編號與 Email'

export type GuestLookupState = {
  order: OrderDetails | null
  message: string | null
}

type GuestLookupProps = {
  action: (state: GuestLookupState | null, formData: FormData) => Promise<GuestLookupState>
}

export function GuestLookup({ action }: GuestLookupProps) {
  const [state, formAction, pending] = useActionState(action, null)

  return (
    <>
      <form action={formAction} className="checkout-form">
        <label>
          訂單編號
          <input name="orderNumber" autoComplete="off" required />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <button className="button" type="submit" disabled={pending}>
          {pending ? '查詢中…' : '查詢訂單'}
        </button>
      </form>
      {state?.message ? <p role="alert">{state.message}</p> : null}
      {state?.order ? <OrderCard order={state.order} /> : null}
    </>
  )
}
