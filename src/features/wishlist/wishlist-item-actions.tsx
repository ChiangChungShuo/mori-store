'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import { getProductAvailability } from '@/features/catalog/availability'
import { trackStorefrontEvent } from '@/features/analytics/tracker'
import { primaryImageForColor } from '@/features/catalog/product-images'
import type { CatalogProduct, CatalogVariant } from '@/features/catalog/queries'

/**
 * Buy controls under a saved product.
 *
 * Kids' clothes always have sizes, so linking out to the product page would
 * cost a page load on every saved item. When a product has one colour the size
 * chips live here and the item goes straight to the cart; only multi-colour
 * products still need the product page.
 */
export function WishlistItemActions({ product }: { product: CatalogProduct }) {
  const { items, dispatch } = useCart()
  const availability = getProductAvailability(product)
  const colors = [...new Set(product.variants.map((variant) => variant.color))]
  const sellable = product.variants.filter((variant) => variant.stock > 0)
  const [selectedId, setSelectedId] = useState(() => (sellable.length === 1 ? sellable[0].id : ''))
  const selected = sellable.find((variant) => variant.id === selectedId) ?? null
  const inCart = selected ? items.some((item) => item.variantId === selected.id) : false

  function addToCart(variant: CatalogVariant) {
    dispatch({
      type: 'add',
      item: {
        variantId: variant.id,
        productSlug: product.slug,
        name: product.name,
        imageUrl: primaryImageForColor(product.images ?? [], variant.color)?.url ?? product.imageUrl,
        color: variant.color,
        size: variant.size,
        unitPrice: variant.price,
        quantity: 1,
        maxStock: variant.stock,
      },
    })
    trackStorefrontEvent('add_to_cart', { productName: product.name })
  }

  if (availability === 'sold_out') {
    return (
      <div className="wishlist-item-actions">
        <Link className="button button-secondary" href={`/products/${product.slug}`}>已售完・看其他款</Link>
      </div>
    )
  }

  if (availability === 'coming_soon') {
    return (
      <div className="wishlist-item-actions">
        <Link className="button button-secondary" href={`/products/${product.slug}`}>看開賣時間</Link>
      </div>
    )
  }

  if (colors.length > 1) {
    return (
      <div className="wishlist-item-actions">
        <Link className="button" href={`/products/${product.slug}`}>選擇顏色與尺寸</Link>
      </div>
    )
  }

  return (
    <div className="wishlist-item-actions">
      <div className="wishlist-size-row" role="group" aria-label={`${product.name} 尺寸`}>
        {product.variants.map((variant) => (
          <button
            aria-pressed={selectedId === variant.id}
            className="wishlist-size-chip"
            disabled={variant.stock === 0}
            key={variant.id}
            onClick={() => setSelectedId(variant.id)}
            type="button"
          >
            {variant.size}
          </button>
        ))}
      </div>
      <button
        className="button"
        disabled={!selected || inCart}
        onClick={() => selected && addToCart(selected)}
        type="button"
      >
        {inCart ? '已在購物車' : selected ? '加入購物車' : '選擇尺寸'}
      </button>
      {selected && selected.stock <= 3 ? <small className="wishlist-low-stock">尺寸 {selected.size} 只剩 {selected.stock} 件</small> : null}
    </div>
  )
}
