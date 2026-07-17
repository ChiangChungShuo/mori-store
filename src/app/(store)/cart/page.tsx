'use client'

import Link from 'next/link'
import { useCart } from '@/features/cart/cart-provider'
import { calculateCart } from '@/features/cart/totals'
import { formatTwd } from '@/lib/money'

const shippingFee = 60
const freeShippingThreshold = 1500

export default function CartPage() {
  const { items, dispatch } = useCart()
  const totals = calculateCart(items, shippingFee, freeShippingThreshold)

  return (
    <main className="section cart-page">
      <header className="page-heading">
        <p>your bag</p>
        <h1>購物袋</h1>
      </header>

      {items.length === 0 ? (
        <div className="catalog-empty">
          <p>購物袋還是空的。</p>
          <Link href="/products" className="button">逛逛商品</Link>
        </div>
      ) : (
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
                    {Array.from({ length: item.maxStock }, (_, index) => index + 1).map((quantity) => (
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
            <button type="button" onClick={() => dispatch({ type: 'clear' })}>清空購物袋</button>
          </aside>
        </div>
      )}
    </main>
  )
}
