'use client'

import { useActionState } from 'react'
import type { BankTransferState } from '@/features/orders/bank-transfer-actions'

const initialState: BankTransferState = { status: 'idle' }

export function BankTransferForm({
  action,
  initialValue,
}: {
  action: (state: BankTransferState, formData: FormData) => Promise<BankTransferState>
  initialValue: string
}) {
  const [state, formAction, pending] = useActionState(action, initialState)
  return (
    <form action={formAction} className="bank-transfer-form">
      <div><p>payment confirmation</p><h3>回報匯款帳號末 5 碼</h3><span>請填寫實際匯出帳號的最後 5 個數字，方便店家核對。</span></div>
      <label>帳號末 5 碼<input name="lastFive" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} minLength={5} defaultValue={initialValue} placeholder="例：12345" required /></label>
      <button className="button" type="submit" disabled={pending}>{pending ? '送出中…' : initialValue ? '更新末 5 碼' : '送出末 5 碼'}</button>
      {state.message ? <p className={`bank-transfer-form-message ${state.status}`} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p> : null}
    </form>
  )
}
