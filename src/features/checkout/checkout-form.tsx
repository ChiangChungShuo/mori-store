'use client'

import { useState } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import { StorePicker } from '@/features/checkout/store-picker'
import type { TestStore } from '@/features/checkout/types'

type CheckoutFormProps = {
  action: (formData: FormData) => void | Promise<void>
}

export function CheckoutForm({ action }: CheckoutFormProps) {
  const { items, hydrated } = useCart()
  const [chain, setChain] = useState<TestStore['chain']>('seven_eleven')
  const [store, setStore] = useState<TestStore | null>(null)
  const cart = items.map(({ variantId, quantity }) => ({ variantId, quantity }))

  return (
    <form action={action} className="checkout-form">
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        收件人姓名
        <input name="recipientName" autoComplete="name" required />
      </label>
      <label>
        手機號碼
        <input
          name="phone"
          type="tel"
          inputMode="numeric"
          pattern="09[0-9]{8}"
          autoComplete="tel"
          required
        />
      </label>
      <StorePicker
        chain={chain}
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
