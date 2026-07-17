'use client'

import Link from 'next/link'
import { useCart } from '@/features/cart/cart-provider'
import { calculateCart } from '@/features/cart/totals'
import { formatTwd } from '@/lib/money'

export function CartDrawer() {
  const { items, dispatch } = useCart()
  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const { subtotal } = calculateCart(items, 0, Number.POSITIVE_INFINITY)

  return (
    <details className="cart-drawer">
      <summary>購物袋（{itemCount}）</summary>
      <div className="cart-drawer-panel">
        <h2>購物袋</h2>
        {items.length === 0 ? <p>購物袋還是空的。</p> : (
          <ul className="cart-list">
            {items.map((item) => (
              <li key={item.variantId}>
                <Link href={`/products/${item.productSlug}`}>{item.name}</Link>
                <p>{item.color}／{item.size} × {item.quantity}</p>
                <button
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
        <Link href="/cart" className="button">查看購物袋</Link>
      </div>
    </details>
  )
}
