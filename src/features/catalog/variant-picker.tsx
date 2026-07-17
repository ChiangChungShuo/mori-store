'use client'

import { useMemo, useState } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import type { CatalogProduct } from '@/features/catalog/queries'

export function VariantPicker({ product }: { product: CatalogProduct }) {
  const { dispatch } = useCart()
  const colors = useMemo(
    () => [...new Set(product.variants.map((variant) => variant.color))],
    [product.variants],
  )
  const [color, setColor] = useState(colors[0] ?? '')
  const [size, setSize] = useState('')
  const variantsForColor = product.variants.filter((variant) => variant.color === color)
  const selectedVariant = variantsForColor.find((variant) => variant.size === size)
  const stockMessage = selectedVariant
    ? `庫存 ${selectedVariant.stock} 件`
    : '請選擇尺寸'

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
              disabled={variant.stock === 0}
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
      <button
        className="button"
        disabled={!selectedVariant || selectedVariant.stock === 0}
        type="button"
        onClick={() => {
          if (!selectedVariant || selectedVariant.stock === 0) return
          dispatch({
            type: 'add',
            item: {
              variantId: selectedVariant.id,
              productSlug: product.slug,
              name: product.name,
              imageUrl: product.imageUrl,
              color: selectedVariant.color,
              size: selectedVariant.size,
              unitPrice: selectedVariant.price,
              quantity: 1,
              maxStock: selectedVariant.stock,
            },
          })
        }}
      >
        加入購物袋
      </button>
    </div>
  )
}
