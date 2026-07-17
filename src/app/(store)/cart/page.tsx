'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import { getCartQuantityLimit, isCartItem } from '@/features/cart/types'
import { calculateCart } from '@/features/cart/totals'
import { formatTwd } from '@/lib/money'

const shippingFee = 60
const freeShippingThreshold = 1500

export default function CartPage() {
  const { items, hydrated, dispatch, replaceItems } = useCart()
  const [refreshStatus, setRefreshStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [refreshAttempt, setRefreshAttempt] = useState(0)
  const refreshKey = JSON.stringify(
    items.map(({ variantId, quantity }) => ({ variantId, quantity })),
  )
  const totals = calculateCart(items, shippingFee, freeShippingThreshold)

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
        const payload = await response.json() as unknown
        if (!response.ok
          || !payload
          || typeof payload !== 'object'
          || !Array.isArray((payload as { items?: unknown }).items)
          || !(payload as { items: unknown[] }).items.every(isCartItem)) {
          throw new Error('Cart refresh failed')
        }

        if (!cancelled) {
          replaceItems((payload as { items: import('@/features/cart/types').CartItem[] }).items)
          setRefreshStatus('success')
        }
      } catch {
        if (!cancelled) setRefreshStatus('error')
      }
    }

    void refreshCart()
    return () => { cancelled = true }
  }, [hydrated, refreshAttempt, refreshKey, replaceItems])

  return (
    <main className="section cart-page">
      <header className="page-heading">
        <p>your bag</p>
        <h1>購物袋</h1>
      </header>

      {!hydrated || (items.length > 0 && refreshStatus === 'loading') ? (
        <p aria-live="polite">正在確認最新商品與庫存…</p>
      ) : items.length === 0 ? (
        <div className="catalog-empty">
          <p>購物袋還是空的。</p>
          <Link href="/products" className="button">逛逛商品</Link>
        </div>
      ) : (
        <>
          {refreshStatus === 'error' ? (
            <div role="alert" className="cart-refresh-error">
              <p>無法更新購物袋，請再試一次。</p>
              <button
                type="button"
                onClick={() => {
                  setRefreshStatus('loading')
                  setRefreshAttempt((attempt) => attempt + 1)
                }}
              >
                重試
              </button>
            </div>
          ) : null}
          <div className="cart-layout">
            <ul className="cart-page-list">
              {items.map((item) => (
                <li key={item.variantId}>
                  <div>
                    <h2><Link href={`/products/${item.productSlug}`}>{item.name}</Link></h2>
                    <p>{item.color}／尺寸 {item.size}</p>
                    <p>{formatTwd(item.unitPrice)}</p>
                  </div>
                  <label>
                    數量
                    <select
                      value={item.quantity}
                      onChange={(event) => dispatch({
                        type: 'setQuantity',
                        variantId: item.variantId,
                        quantity: Number(event.target.value),
                      })}
                    >
                      {Array.from(
                        { length: getCartQuantityLimit(item.maxStock) },
                        (_, index) => index + 1,
                      ).map((quantity) => (
                        <option key={quantity} value={quantity}>{quantity}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'remove', variantId: item.variantId })}
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>

            <aside className="cart-summary" aria-label="訂單摘要">
              <h2>訂單摘要</h2>
              <p><span>商品小計</span><strong>{formatTwd(totals.subtotal)}</strong></p>
              <p><span>運費</span><strong>{totals.shipping === 0 ? '免運' : formatTwd(totals.shipping)}</strong></p>
              <p className="cart-total"><span>合計</span><strong>{formatTwd(totals.total)}</strong></p>
              <p>滿 {formatTwd(freeShippingThreshold)} 免運。</p>
              <Link href="/checkout" className="button">前往結帳</Link>
              <button type="button" onClick={() => dispatch({ type: 'clear' })}>清空購物袋</button>
            </aside>
          </div>
        </>
      )}
    </main>
  )
}
