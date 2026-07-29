'use client'

import type { ProductInput } from '@/lib/validation/product'
import type { ProductVariantErrors } from '@/lib/validation/product'

type Variant = ProductInput['variants'][number]

type VariantGridProps = {
  variants: Variant[]
  onChange: (variants: Variant[]) => void
  errors?: ProductVariantErrors
}

const emptyVariant: Variant = {
  sku: '',
  color: '',
  size: '',
  price: 0,
  cost: 0,
  stock: 0,
}

export function VariantGrid({ variants, onChange, errors = [] }: VariantGridProps) {
  function update(index: number, field: keyof Variant, value: string | number | undefined) {
    onChange(variants.map((variant, variantIndex) => (
      variantIndex === index ? { ...variant, [field]: value } : variant
    )))
  }

  return (
    <fieldset className="admin-variant-fieldset">
      <legend className="sr-only">商品規格</legend>
      <p className="admin-sku-help"><strong>SKU 是什麼？</strong>它是每個「顏色＋尺寸」專用的內部庫存編號，顧客不會看到。例：<code>MORI-TEE-GREEN-110</code></p>
      <div className="admin-variant-labels" aria-hidden="true"><span>SKU</span><span>顏色</span><span>尺寸</span><span>售價</span><span>成本</span><span>原價</span><span>庫存</span><span /></div>
      {variants.map((variant, index) => (
        <div className="admin-variant-row" data-invalid={Boolean(errors[index] && Object.keys(errors[index]).length > 0)} key={variant.id ?? index}>
          <p>規格 {String(index + 1).padStart(2, '0')}</p>
          <label>
            SKU
            <input
              aria-label="SKU"
              aria-invalid={Boolean(errors[index]?.sku)}
              value={variant.sku}
              onChange={(event) => update(index, 'sku', event.target.value)}
              required
            />
            {errors[index]?.sku ? <small>{errors[index].sku?.[0]}</small> : null}
          </label>
          <label>
            顏色
            <input
              aria-label="顏色"
              aria-invalid={Boolean(errors[index]?.color)}
              value={variant.color}
              onChange={(event) => update(index, 'color', event.target.value)}
              required
            />
            {errors[index]?.color ? <small>{errors[index].color?.[0]}</small> : null}
          </label>
          <label>
            尺寸
            <input
              aria-label="尺寸"
              aria-invalid={Boolean(errors[index]?.size)}
              value={variant.size}
              onChange={(event) => update(index, 'size', event.target.value)}
              required
            />
            {errors[index]?.size ? <small>{errors[index].size?.[0]}</small> : null}
          </label>
          <label>
            售價
            <input
              aria-label="售價"
              aria-invalid={Boolean(errors[index]?.price)}
              type="number"
              min="0"
              step="1"
              value={variant.price}
              onChange={(event) => update(index, 'price', event.target.valueAsNumber)}
              required
            />
            {errors[index]?.price ? <small>{errors[index].price?.[0]}</small> : null}
          </label>
          <label>
            成本
            <input
              aria-label="成本"
              aria-invalid={Boolean(errors[index]?.cost)}
              type="number"
              min="0"
              step="1"
              value={variant.cost ?? 0}
              onChange={(event) => update(index, 'cost', event.target.valueAsNumber)}
            />
            {errors[index]?.cost ? <small>{errors[index].cost?.[0]}</small> : null}
          </label>
          <label>
            原價
            <input
              aria-label="原價"
              aria-invalid={Boolean(errors[index]?.compareAtPrice)}
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
            {errors[index]?.compareAtPrice ? <small>{errors[index].compareAtPrice?.[0]}</small> : null}
          </label>
          <label>
            庫存
            <input
              aria-label="庫存"
              aria-invalid={Boolean(errors[index]?.stock)}
              type="number"
              min="0"
              step="1"
              value={variant.stock}
              onChange={(event) => update(index, 'stock', event.target.valueAsNumber)}
              required
            />
            {errors[index]?.stock ? <small>{errors[index].stock?.[0]}</small> : null}
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
      <button aria-label="新增規格" className="admin-add-variant" type="button" onClick={() => onChange([...variants, { ...emptyVariant }])}>
        ＋ 新增顏色／尺寸規格
      </button>
    </fieldset>
  )
}
