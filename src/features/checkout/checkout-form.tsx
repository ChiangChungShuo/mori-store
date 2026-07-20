'use client'

import { useActionState, useEffect, useState } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import { isCartItem } from '@/features/cart/types'
import { StorePicker } from '@/features/checkout/store-picker'
import type { CheckoutActionState, TestStore } from '@/features/checkout/types'
import { formatTwd } from '@/lib/money'

type CheckoutFormProps = {
  action: (
    previousState: CheckoutActionState,
    formData: FormData,
  ) => CheckoutActionState | Promise<CheckoutActionState>
}

const initialState: CheckoutActionState = { status: 'idle' }

type CheckoutField = 'email' | 'recipientName' | 'phone' | 'chain' | 'storeId'

const errorIds: Record<CheckoutField, string> = {
  email: 'checkout-email-error',
  recipientName: 'checkout-recipient-name-error',
  phone: 'checkout-phone-error',
  chain: 'checkout-chain-error',
  storeId: 'checkout-store-error',
}

export function CheckoutForm({ action }: CheckoutFormProps) {
  const { items, hydrated, replaceItems } = useCart()
  const [state, formAction, pending] = useActionState(action, initialState)
  const [chain, setChain] = useState<TestStore['chain']>('seven_eleven')
  const [store, setStore] = useState<TestStore | null>(null)
  const [errors, setErrors] = useState<Partial<Record<CheckoutField, string>>>({})
  const [refreshAttempt, setRefreshAttempt] = useState(0)
  const [refreshedKey, setRefreshedKey] = useState('')
  const [refreshErrorKey, setRefreshErrorKey] = useState('')
  const [summary, setSummary] = useState<{ subtotal: number; shipping: number; total: number } | null>(null)
  const refreshKey = JSON.stringify(items.map(({ variantId, quantity }) => ({ variantId, quantity })))
  const effectiveRefreshStatus = !hydrated || (refreshKey !== '[]'
    && refreshedKey !== refreshKey
    && refreshErrorKey !== refreshKey)
    ? 'loading'
    : refreshErrorKey === refreshKey
      ? 'error'
      : 'success'
  const cart = items.map(({ variantId, quantity }) => ({ variantId, quantity }))

  useEffect(() => {
    if (!hydrated || refreshKey === '[]') return

    let cancelled = false
    async function refreshCart() {
      try {
        const response = await fetch('/api/cart/refresh', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: `{"items":${refreshKey}}`,
        })
        const payload = await response.json() as {
          items?: unknown
          summary?: { subtotal?: unknown; shipping?: unknown; total?: unknown }
        }
        const nextSummary = payload.summary
        if (!response.ok
          || !Array.isArray(payload.items)
          || !payload.items.every(isCartItem)
          || !nextSummary
          || !Number.isInteger(nextSummary.subtotal)
          || !Number.isInteger(nextSummary.shipping)
          || !Number.isInteger(nextSummary.total)) {
          throw new Error('checkout refresh failed')
        }
        if (!cancelled) {
          replaceItems(payload.items)
          setSummary(nextSummary as { subtotal: number; shipping: number; total: number })
          setRefreshedKey(refreshKey)
          setRefreshErrorKey('')
        }
      } catch {
        if (!cancelled) setRefreshErrorKey(refreshKey)
      }
    }

    void refreshCart()
    return () => { cancelled = true }
  }, [hydrated, refreshAttempt, refreshKey, replaceItems])

  function retryRefresh() {
    setRefreshErrorKey('')
    setRefreshAttempt((attempt) => attempt + 1)
  }

  return (
    <form
      action={formAction}
      className="checkout-form"
      onInput={(event) => {
        const target = event.target
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return
        if (!target.validity.valid || !target.name) return
        setErrors((current) => ({ ...current, [target.name]: undefined }))
      }}
      onInvalid={(event) => {
        const target = event.target
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return
        if (!(target.name in errorIds)) return
        setErrors((current) => ({
          ...current,
          [target.name]: target.validationMessage || '請檢查此欄位。',
        }))
      }}
    >
      <label>
        Email
        <input
          aria-describedby={errors.email ? errorIds.email : undefined}
          aria-invalid={Boolean(errors.email)}
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>
      {errors.email ? <span id={errorIds.email} role="alert">{errors.email}</span> : null}
      <label>
        收件人姓名
        <input
          aria-describedby={errors.recipientName ? errorIds.recipientName : undefined}
          aria-invalid={Boolean(errors.recipientName)}
          name="recipientName"
          autoComplete="name"
          required
        />
      </label>
      {errors.recipientName ? (
        <span id={errorIds.recipientName} role="alert">{errors.recipientName}</span>
      ) : null}
      <label>
        手機號碼
        <input
          aria-describedby={errors.phone ? errorIds.phone : undefined}
          aria-invalid={Boolean(errors.phone)}
          name="phone"
          type="tel"
          inputMode="numeric"
          pattern="09[0-9]{8}"
          autoComplete="tel"
          required
        />
      </label>
      {errors.phone ? <span id={errorIds.phone} role="alert">{errors.phone}</span> : null}
      <StorePicker
        chain={chain}
        errors={{ chain: errors.chain, storeId: errors.storeId }}
        storeId={store?.chain === chain ? store.storeId : ''}
        onChainChange={(nextChain) => {
          setChain(nextChain)
          setStore(null)
        }}
        onStoreChange={setStore}
      />
      {state.status === 'error' ? (
        <div role="alert">
          <p>{state.message}</p>
          {state.refreshCart ? (
            <button className="button button-secondary" type="button" onClick={retryRefresh}>更新購物車</button>
          ) : null}
        </div>
      ) : null}
      {effectiveRefreshStatus === 'loading' ? <p aria-live="polite">正在確認最新商品與庫存…</p> : null}
      {effectiveRefreshStatus === 'error' ? (
        <div role="alert">
          <p>無法更新購物車，請再試一次。</p>
          <button className="button button-secondary" type="button" onClick={retryRefresh}>重試</button>
        </div>
      ) : null}
      {effectiveRefreshStatus === 'success' && summary && cart.length > 0 ? (
        <aside className="cart-summary" aria-label="訂單摘要">
          <h2>訂單摘要</h2>
          <ul>
            {items.map((item) => (
              <li key={item.variantId}>
                <span>{item.name}（{item.color}／{item.size}）× {item.quantity}</span>
                <strong>{formatTwd(item.unitPrice * item.quantity)}</strong>
              </li>
            ))}
          </ul>
          <p><span>商品小計</span><strong>{formatTwd(summary.subtotal)}</strong></p>
          <p><span>運費</span><strong>{summary.shipping === 0 ? '免運' : formatTwd(summary.shipping)}</strong></p>
          <p className="cart-total"><span>合計</span><strong>{formatTwd(summary.total)}</strong></p>
        </aside>
      ) : null}
      <input type="hidden" name="cart" value={JSON.stringify(cart)} />
      <button
        className="button"
        type="submit"
        disabled={pending || !hydrated || effectiveRefreshStatus !== 'success' || cart.length === 0}
      >
        {pending ? '建立付款交易中…' : '前往測試付款'}
      </button>
      {hydrated && cart.length === 0 ? <p role="alert">購物車沒有可結帳的商品。</p> : null}
    </form>
  )
}
