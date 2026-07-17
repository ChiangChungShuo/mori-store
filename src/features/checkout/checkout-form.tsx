'use client'

import { useState } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import { StorePicker } from '@/features/checkout/store-picker'
import type { TestStore } from '@/features/checkout/types'

type CheckoutFormProps = {
  action: (formData: FormData) => void | Promise<void>
}

type CheckoutField = 'email' | 'recipientName' | 'phone' | 'chain' | 'storeId'

const errorIds: Record<CheckoutField, string> = {
  email: 'checkout-email-error',
  recipientName: 'checkout-recipient-name-error',
  phone: 'checkout-phone-error',
  chain: 'checkout-chain-error',
  storeId: 'checkout-store-error',
}

export function CheckoutForm({ action }: CheckoutFormProps) {
  const { items, hydrated } = useCart()
  const [chain, setChain] = useState<TestStore['chain']>('seven_eleven')
  const [store, setStore] = useState<TestStore | null>(null)
  const [errors, setErrors] = useState<Partial<Record<CheckoutField, string>>>({})
  const cart = items.map(({ variantId, quantity }) => ({ variantId, quantity }))

  return (
    <form
      action={action}
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
      <input type="hidden" name="cart" value={JSON.stringify(cart)} />
      <button className="button" type="submit" disabled={!hydrated || cart.length === 0 || !store}>
        前往測試付款
      </button>
      {hydrated && cart.length === 0 ? <p role="alert">購物袋沒有可結帳的商品。</p> : null}
    </form>
  )
}
