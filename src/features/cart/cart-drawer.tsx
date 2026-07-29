'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import { getCartQuantityLimit } from '@/features/cart/types'
import { calculateCart } from '@/features/cart/totals'
import type { StorefrontSettings } from '@/features/checkout/settings'
import { formatTwd } from '@/lib/money'

export function CartDrawer({ settings }: { settings: StorefrontSettings }) {
  const { items, dispatch } = useCart()
  const [bumping, setBumping] = useState(false)
  const [open, setOpen] = useState(false)
  const bumpTimer = useRef<number | null>(null)
  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const totals = calculateCart(items, settings.shippingFee, settings.freeShippingThreshold)
  const freeShippingRemaining = settings.freeShippingThreshold === null
    ? null
    : Math.max(0, settings.freeShippingThreshold - totals.subtotal)
  const freeShippingProgress = settings.freeShippingThreshold && settings.freeShippingThreshold > 0
    ? Math.min(100, Math.round((totals.subtotal / settings.freeShippingThreshold) * 100))
    : 100

  useEffect(() => {
    function bumpCart() {
      setOpen(true)
      setBumping(false)
      window.requestAnimationFrame(() => setBumping(true))
      if (bumpTimer.current !== null) window.clearTimeout(bumpTimer.current)
      bumpTimer.current = window.setTimeout(() => setBumping(false), 650)
    }

    window.addEventListener('mori:cart-added', bumpCart)
    return () => {
      window.removeEventListener('mori:cart-added', bumpCart)
      if (bumpTimer.current !== null) window.clearTimeout(bumpTimer.current)
    }
  }, [])

  return (
    <details
      aria-label="購物車內容"
      className="cart-drawer"
      data-cart-state={bumping ? 'added' : 'idle'}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary>
        <svg className="cart-icon" aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 5h2l1.5 9h9.8l1.7-6H7" />
          <circle cx="10" cy="18.5" r="1" />
          <circle cx="17" cy="18.5" r="1" />
        </svg>
        購物車<span className="cart-count" aria-label={`${itemCount} 件商品`}>{itemCount}</span>
      </summary>
      <button aria-label="關閉購物車" className="cart-drawer-backdrop" onClick={() => setOpen(false)} type="button" />
      <div className="cart-drawer-panel">
        <div className="cart-drawer-heading">
          <div><p>your cart</p><h2>購物車</h2></div>
          <button aria-label="關閉購物車" onClick={() => setOpen(false)} type="button">×</button>
        </div>
        {items.length === 0 ? <p className="cart-empty">購物車目前是空的，去看看本週新品吧。</p> : (
          <ul className="cart-list">
            {items.map((item) => (
              <li key={item.variantId}>
                <Link className="cart-drawer-image" href={`/products/${item.productSlug}`}>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={item.name} src={item.imageUrl} />
                  ) : <span aria-label={item.name} role="img">mori</span>}
                </Link>
                <div className="cart-drawer-item-copy">
                  <Link href={`/products/${item.productSlug}`}>{item.name}</Link>
                  <p>{item.color}／尺寸 {item.size}</p>
                  <p>{formatTwd(item.unitPrice)}</p>
                  <div className="quantity-stepper quantity-stepper-small" role="group" aria-label={`${item.name} 數量調整`}>
                    <button
                      aria-label={`減少 ${item.name} 數量`}
                      disabled={item.quantity <= 1}
                      onClick={() => dispatch({ type: 'setQuantity', variantId: item.variantId, quantity: item.quantity - 1 })}
                      type="button"
                    >−</button>
                    <output aria-label={`${item.name} 數量`} aria-live="polite">{item.quantity}</output>
                    <button
                      aria-label={`增加 ${item.name} 數量`}
                      disabled={item.quantity >= getCartQuantityLimit(item.maxStock)}
                      onClick={() => dispatch({ type: 'setQuantity', variantId: item.variantId, quantity: item.quantity + 1 })}
                      type="button"
                    >＋</button>
                  </div>
                </div>
                <button
                  aria-label={`移除 ${item.name}`}
                  className="cart-remove-button"
                  type="button"
                  onClick={() => dispatch({ type: 'remove', variantId: item.variantId })}
                >×</button>
              </li>
            ))}
          </ul>
        )}
        {items.length > 0 && freeShippingRemaining !== null ? (
          <div className="shipping-progress cart-drawer-progress">
            <p>{freeShippingRemaining > 0
              ? <>再買 <strong>{formatTwd(freeShippingRemaining)}</strong> 即享免運</>
              : <strong>已達免運門檻</strong>}</p>
            <div className="shipping-progress-track" aria-label={`免運進度 ${freeShippingProgress}%`}>
              <span style={{ width: `${freeShippingProgress}%` }} />
            </div>
            <small>滿 {formatTwd(settings.freeShippingThreshold ?? 0)} 超商取貨免運</small>
          </div>
        ) : null}
        {items.length > 0 ? (
          <div className="cart-drawer-totals">
            <p><span>商品小計</span><strong>{formatTwd(totals.subtotal)}</strong></p>
            <p><span>運費</span><strong>{totals.shipping === 0 ? '免運' : formatTwd(totals.shipping)}</strong></p>
            <p className="cart-total"><span>合計</span><strong>{formatTwd(totals.total)}</strong></p>
          </div>
        ) : null}
        <div className="cart-drawer-actions">
          <Link href="/cart" className="button button-secondary" onClick={() => setOpen(false)}>查看購物車</Link>
          {items.length > 0 ? <Link href="/checkout" className="button" onClick={() => setOpen(false)}>前往結帳</Link> : null}
        </div>
      </div>
    </details>
  )
}
