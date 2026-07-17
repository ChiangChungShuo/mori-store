'use client'

import type { ProductInput } from '@/lib/validation/product'

type Variant = ProductInput['variants'][number]

type VariantGridProps = {
  variants: Variant[]
  onChange: (variants: Variant[]) => void
}

const emptyVariant: Variant = {
  sku: '',
  color: '',
  size: '',
  price: 0,
  stock: 0,
}

export function VariantGrid({ variants, onChange }: VariantGridProps) {
  function update(index: number, field: keyof Variant, value: string | number | undefined) {
    onChange(variants.map((variant, variantIndex) => (
      variantIndex === index ? { ...variant, [field]: value } : variant
    )))
  }

  return (
    <fieldset>
      <legend>商品規格</legend>
      {variants.map((variant, index) => (
        <div className="admin-variant-row" key={index}>
          <label>
            SKU
            <input
              aria-label="SKU"
              value={variant.sku}
              onChange={(event) => update(index, 'sku', event.target.value)}
              required
            />
          </label>
          <label>
            顏色
            <input
              aria-label="顏色"
              value={variant.color}
              onChange={(event) => update(index, 'color', event.target.value)}
              required
            />
          </label>
          <label>
            尺寸
            <input
              aria-label="尺寸"
              value={variant.size}
              onChange={(event) => update(index, 'size', event.target.value)}
              required
            />
          </label>
          <label>
            售價
            <input
              aria-label="售價"
              type="number"
              min="0"
              step="1"
              value={variant.price}
              onChange={(event) => update(index, 'price', event.target.valueAsNumber)}
              required
            />
          </label>
          <label>
            原價
            <input
              aria-label="原價"
              type="number"
              min="0"
              step="1"
              value={variant.compareAtPrice ?? ''}
              onChange={(event) => update(
                index,
                'compareAtPrice',
                event.target.value === '' ? undefined : event.target.valueAsNumber,
              )}
            />
          </label>
          <label>
            庫存
            <input
              aria-label="庫存"
              type="number"
              min="0"
              step="1"
              value={variant.stock}
              onChange={(event) => update(index, 'stock', event.target.valueAsNumber)}
              required
            />
          </label>
          <button
            type="button"
            onClick={() => onChange(variants.filter((_, variantIndex) => variantIndex !== index))}
            disabled={variants.length === 1}
          >
            移除規格
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...variants, { ...emptyVariant }])}>
        新增規格
      </button>
    </fieldset>
  )
}
