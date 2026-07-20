'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import { calculateCart } from '@/features/cart/totals'
import { formatTwd } from '@/lib/money'

export function CartDrawer() {
  const { items, dispatch } = useCart()
  const [bumping, setBumping] = useState(false)
  const bumpTimer = useRef<number | null>(null)
  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const { subtotal } = calculateCart(items, 0, Number.POSITIVE_INFINITY)

  useEffect(() => {
    function bumpCart() {
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
    <details className="cart-drawer" data-cart-state={bumping ? 'added' : 'idle'}>
      <summary>
        <svg className="cart-icon" aria-hidden="true" viewBox="0 0 24 24">
          <path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6.1M10 20h.01M18 20h.01" />
        </svg>
        購物車<span className="cart-count" aria-label={`${itemCount} 件商品`}>{itemCount}</span>
      </summary>
      <div className="cart-drawer-panel">
        <div className="cart-drawer-heading"><p>your cart</p><h2>購物車</h2></div>
        {items.length === 0 ? <p className="cart-empty">購物車目前是空的，去看看本週新品吧。</p> : (
          <ul className="cart-list">
            {items.map((item) => (
              <li key={item.variantId}>
                <Link href={`/products/${item.productSlug}`}>{item.name}</Link>
                <p>{item.color}／{item.size} × {item.quantity}</p>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => dispatch({ type: 'remove', variantId: item.variantId })}
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="cart-subtotal">小計 {formatTwd(subtotal)}</p>
        <Link href="/cart" className="button button-wide">查看購物車</Link>
      </div>
    </details>
  )
}
