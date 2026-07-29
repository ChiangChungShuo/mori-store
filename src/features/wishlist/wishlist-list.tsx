'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatTwd } from '@/lib/money'
import type { CatalogProduct } from '@/features/catalog/queries'
import { readWishlistIds, writeWishlistIds, WishlistButton } from './wishlist-button'

export function WishlistList({ products }: { products: CatalogProduct[] }) {
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

  const savedProducts = products.filter((product) => ids?.includes(product.id))

  if (ids === null) return <p className="wishlist-loading">正在整理追蹤清單…</p>
  if (savedProducts.length === 0) {
    return (
      <div className="account-empty wishlist-empty">
        <span aria-hidden="true">♡</span>
        <h2>還沒有收藏商品</h2>
        <p>在商品卡片或商品頁點選愛心，喜歡的款式就會收在這裡。</p>
        <Link className="button" href="/products">去逛逛商品</Link>
      </div>
    )
  }

  return (
    <div className="wishlist-grid" data-columns={savedProducts.length > 1 ? '2' : '1'}>
      {savedProducts.map((product) => {
        const minimumPrice = Math.min(...product.variants.map((variant) => variant.price))
        return (
          <article key={product.id}>
            <Link className="wishlist-image" href={`/products/${product.slug}`}>
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={product.imageAlt} src={product.imageUrl} />
              ) : <span aria-hidden="true">mori</span>}
            </Link>
            <div><p>{product.category}</p><h2><Link href={`/products/${product.slug}`}>{product.name}</Link></h2><strong>{formatTwd(minimumPrice)} 起</strong></div>
            <WishlistButton compact productId={product.id} productName={product.name} />
          </article>
        )
      })}
    </div>
  )
}
