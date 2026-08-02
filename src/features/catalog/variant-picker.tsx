'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import type { CatalogProduct } from '@/features/catalog/queries'
import { trackStorefrontEvent } from '@/features/analytics/tracker'
import { getProductAvailability } from '@/features/catalog/availability'
import { useProductColor } from '@/features/catalog/product-color-context'
import { primaryImageForColor } from '@/features/catalog/product-images'

export function VariantPicker({ product }: { product: CatalogProduct }) {
  const { dispatch } = useCart()
  const { color, setColor } = useProductColor()
  const feedbackTimer = useRef<number | null>(null)
  const [added, setAdded] = useState(false)
  const [restockRequested, setRestockRequested] = useState(false)
  const colors = useMemo(
    () => [...new Set(product.variants.map((variant) => variant.color))],
    [product.variants],
  )
  const [size, setSize] = useState('')
  const variantsForColor = product.variants.filter((variant) => variant.color === color)
  const selectedVariant = variantsForColor.find((variant) => variant.size === size)
  const availability = getProductAvailability(product)
  const stockMessage = availability === 'sold_out'
      ? '此商品目前已售完'
      : selectedVariant
    ? '尺寸已選擇，可以加入購物車'
    : '請選擇尺寸'

  useEffect(() => () => {
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
  }, [])

  return (
    <div className="variant-picker">
      <fieldset>
        <legend>顏色</legend>
        <div className="choice-list">
          {colors.map((choice) => (
            <button
              aria-label={`顏色 ${choice}`}
              aria-pressed={choice === color}
              key={choice}
              type="button"
              onClick={() => {
                setColor(choice)
                setSize('')
              }}
            >
              {choice}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>尺寸</legend>
        <div className="choice-list">
          {variantsForColor.map((variant) => (
            <button
              aria-label={`尺寸 ${variant.size}${variant.stock === 0 ? '（缺貨）' : ''}`}
              aria-pressed={variant.size === size}
              disabled={variant.stock === 0 || availability !== 'available'}
              key={variant.id}
              type="button"
              onClick={() => setSize(variant.size)}
            >
              {variant.size}{variant.stock === 0 ? '（缺貨）' : ''}
            </button>
          ))}
        </div>
      </fieldset>

      <p aria-live="polite" role="status">{stockMessage}</p>
      {availability === 'sold_out' ? <button
        className="button restock-alert-button"
        disabled={restockRequested}
        type="button"
        onClick={() => {
          setRestockRequested(true)
          window.localStorage.setItem(`mori-restock-${product.id}`, '1')
        }}
      >
        <span aria-hidden="true">{restockRequested ? '✓' : '✉'}</span>
        {restockRequested ? '已登記到貨通知' : '貨到通知我'}
      </button> : null}
      {availability !== 'sold_out' ? <button
        className="button add-to-cart-button"
        data-cart-state={added ? 'added' : 'idle'}
        disabled={availability !== 'available' || !selectedVariant || selectedVariant.stock === 0}
        type="button"
        onClick={(event) => {
          if (!selectedVariant || selectedVariant.stock === 0) return
          dispatch({
            type: 'add',
            item: {
              variantId: selectedVariant.id,
              productSlug: product.slug,
              name: product.name,
              imageUrl: primaryImageForColor(product.images ?? [], selectedVariant.color)?.url ?? product.imageUrl,
              color: selectedVariant.color,
              size: selectedVariant.size,
              unitPrice: selectedVariant.price,
              quantity: 1,
              maxStock: selectedVariant.stock,
            },
          })
          trackStorefrontEvent('add_to_cart', { productName: product.name })

          setAdded(true)
          if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
          feedbackTimer.current = window.setTimeout(() => setAdded(false), 1400)

          const cartTarget = document.querySelector<HTMLElement>('.cart-drawer summary')
          const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          if (cartTarget && !reduceMotion) {
            const start = event.currentTarget.getBoundingClientRect()
            const end = cartTarget.getBoundingClientRect()
            const flyer = document.createElement('span')
            flyer.className = 'cart-flyer'
            flyer.style.setProperty('--fly-start-x', `${start.left + start.width / 2}px`)
            flyer.style.setProperty('--fly-start-y', `${start.top + start.height / 2}px`)
            flyer.style.setProperty('--fly-end-x', `${end.left + end.width / 2}px`)
            flyer.style.setProperty('--fly-end-y', `${end.top + end.height / 2}px`)
            flyer.addEventListener('animationend', () => flyer.remove(), { once: true })
            document.body.append(flyer)
          }

          window.dispatchEvent(new CustomEvent('mori:cart-added'))
        }}
      >
        <span aria-hidden="true">{added ? '✓' : '+'}</span>
        {availability === 'coming_soon' ? '尚未開放購買' : added ? '已加入購物車' : '加入購物車'}
      </button> : null}
    </div>
  )
}
