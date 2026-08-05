'use client'

import { useActionState, useState } from 'react'
import { registerRestockRequest } from '@/features/catalog/restock-actions'
import type { RestockRequestState } from '@/features/catalog/restock-requests'

const initialState: RestockRequestState = { status: 'idle', message: '' }

/**
 * Sold-out products still get visitors with the highest intent in the shop, so
 * take an email instead of only saying "已售完". The button opens the field on
 * demand — an always-visible email input on a sold-out product reads as a
 * newsletter sign-up and gets ignored.
 */
export function RestockForm({ productId, defaultEmail = '' }: {
  productId: string
  defaultEmail?: string
}) {
  const [state, formAction, pending] = useActionState(registerRestockRequest, initialState)
  const [open, setOpen] = useState(false)

  if (state.status === 'ok') {
    return (
      <p className="restock-form-done" role="status">
        <span aria-hidden="true">✓</span>{state.message}
      </p>
    )
  }

  if (!open) {
    return (
      <button className="button restock-alert-button" onClick={() => setOpen(true)} type="button">
        <span aria-hidden="true">✉</span>貨到通知我
      </button>
    )
  }

  return (
    <form action={formAction} className="restock-form" data-no-confirm>
      <input name="productId" type="hidden" value={productId} />
      <label>
        補貨時通知我
        <input
          autoComplete="email"
          defaultValue={defaultEmail}
          name="email"
          placeholder="name@example.com"
          required
          type="email"
        />
      </label>
      <button className="button" disabled={pending} type="submit">
        {pending ? '登記中…' : '登記通知'}
      </button>
      {state.status === 'error' ? <small role="alert">{state.message}</small> : null}
      <small>只用於這件商品的補貨通知，不會用來寄送廣告。</small>
    </form>
  )
}
