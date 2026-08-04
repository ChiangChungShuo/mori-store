'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { OrderCard } from '@/features/orders/order-card'
import type { OrderDetails } from '@/features/orders/queries'
import { BankTransferForm } from '@/features/orders/bank-transfer-form'
import type { BankTransferState } from '@/features/orders/bank-transfer-actions'

export const guestLookupMissMessage = '查無訂單，請確認訂單編號與 Email'

export type GuestLookupState = {
  order: OrderDetails | null
  message: string | null
}

type GuestLookupProps = {
  action: (state: GuestLookupState | null, formData: FormData) => Promise<GuestLookupState>
  bankTransferAction: (
    orderNumber: string,
    email: string,
    state: BankTransferState,
    formData: FormData,
  ) => Promise<BankTransferState>
}

export function GuestLookup({ action, bankTransferAction }: GuestLookupProps) {
  const [state, formAction, pending] = useActionState(action, null)

  return (
    <div className="guest-lookup-shell">
      <aside className="guest-lookup-guide">
        <p className="eyebrow">quick guide</p>
        <h2>不用登入，也能掌握包裹進度。</h2>
        <ol><li><span>01</span>打開訂單成立通知信</li><li><span>02</span>輸入訂單編號與下單 Email</li><li><span>03</span>查看付款、出貨與取貨狀態</li></ol>
        <p>有 mori 帳號嗎？會員可一次查看所有歷史訂單。</p>
        <Link className="text-link" href="/login?next=/account/orders">登入查看我的訂單 →</Link>
      </aside>
      <div className="guest-lookup-content">
      <form action={formAction} className="guest-lookup-form">
        <header><span>ORDER STATUS</span><h2>輸入訂單資料</h2><p>資料須與下單時完全相同，英文大小寫不影響查詢。</p></header>
        <label>
          訂單編號
          <input name="orderNumber" autoCapitalize="characters" autoComplete="off" placeholder="例：MORI-69D0E0823B" required />
          <small>可在訂單成立 Email 中找到</small>
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" placeholder="name@example.com" required />
        </label>
        <button className="button" type="submit" disabled={pending}>
          {pending ? '查詢中…' : '查詢訂單'}
        </button>
      </form>
      {state?.message ? <p className="guest-lookup-error" role="alert">{state.message}</p> : null}
      {state?.order ? <div className="guest-lookup-result">
        <OrderCard order={state.order} />
        {state.order.paymentMethod === 'bank_transfer' && state.order.status === 'pending_payment' ? (
          <BankTransferForm
            action={bankTransferAction.bind(null, state.order.orderNumber, state.order.email)}
            initialValue={state.order.bankTransferLastFive ?? ''}
          />
        ) : null}
      </div> : null}
      </div>
    </div>
  )
}
