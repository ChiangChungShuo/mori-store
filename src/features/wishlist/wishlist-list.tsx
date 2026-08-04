'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatTwd } from '@/lib/money'
import { ProductCard } from '@/features/catalog/product-card'
import { WishlistItemActions } from './wishlist-item-actions'
import type { CatalogProduct } from '@/features/catalog/queries'
import { readWishlistIds, writeWishlistIds } from './wishlist-button'

export function WishlistList({ products, freeShippingThreshold = null }: {
  products: CatalogProduct[]
  freeShippingThreshold?: number | null
}) {
  const [ids, setIds] = useState<string[] | null>(null)

  useEffect(() => {
    const sync = () => setIds(readWishlistIds())
    sync()
    window.addEventListener('mori:wishlist-changed', sync)
    return () => window.removeEventListener('mori:wishlist-changed', sync)
  }, [])

  // Drop saved ids that no longer match a real product (e.g. leftovers from earlier
  // preview/testing) so the header count reflects only items that actually exist.
  useEffect(() => {
    if (ids === null) return
    const valid = ids.filter((id) => products.some((product) => product.id === id))
    if (valid.length !== ids.length) writeWishlistIds(valid)
  }, [ids, products])

  const savedProducts = useMemo(
    () => products.filter((product) => ids?.includes(product.id)),
    [products, ids],
  )

  const total = savedProducts.reduce(
    (sum, product) => sum + Math.min(...product.variants.map((variant) => variant.price)),
    0,
  )
  const remainingForFreeShipping = freeShippingThreshold ? Math.max(0, freeShippingThreshold - total) : 0

  if (ids === null) return <p className="wishlist-loading">正在整理追蹤清單…</p>

  if (savedProducts.length === 0) {
    return (
      <div className="account-empty wishlist-empty">
        <span aria-hidden="true">♡</span>
        <h2>還沒有收藏商品</h2>
        <p>在商品卡片或商品頁點選愛心，喜歡的款式就會收在這裡，回來時能直接選尺寸下單。</p>
        <div className="wishlist-empty-actions">
          <Link className="button" href="/products?view=ready">看現貨商品</Link>
          <Link className="text-link" href="/products?view=popular">本週熱賣 →</Link>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Summary first: how much the saved items come to, and how close that is
          to free shipping — the nudge that turns a saved list into an order. */}
      <div className="wishlist-summary">
        <div className="wishlist-summary-figures">
          <p><span>收藏</span><strong>{savedProducts.length} 件</strong></p>
          <p><span>合計約</span><strong>{formatTwd(total)}</strong></p>
        </div>
        {freeShippingThreshold ? (
          <div className="wishlist-shipping" data-reached={remainingForFreeShipping === 0}>
            <p>{remainingForFreeShipping === 0
              ? `合計已超過 ${formatTwd(freeShippingThreshold)}，一起結帳就免運`
              : `合計再 ${formatTwd(remainingForFreeShipping)} 即可免運`}</p>
            <div><i style={{ width: `${Math.min(100, Math.round((total / freeShippingThreshold) * 100))}%` }} /></div>
          </div>
        ) : null}
        <div className="wishlist-summary-actions">
          <Link className="button button-secondary" href="/cart">查看購物車</Link>
          <Link className="text-link" href="/products">繼續選購 →</Link>
        </div>
      </div>

      <div className="wishlist-grid">
        {savedProducts.map((product) => (
          <div className="wishlist-item" key={product.id}>
            <ProductCard product={product} />
            <WishlistItemActions product={product} />
          </div>
        ))}
      </div>
    </>
  )
}
