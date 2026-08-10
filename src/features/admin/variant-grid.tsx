'use client'

import { useMemo, useState } from 'react'
import type { ProductInput } from '@/lib/validation/product'
import type { ProductVariantErrors } from '@/lib/validation/product'
import {
  generateVariantMatrix,
  parseVariantList,
  suggestSkuPrefix,
  withoutBlankVariants,
} from '@/features/admin/variant-matrix'

type Variant = ProductInput['variants'][number]

type VariantGridProps = {
  variants: Variant[]
  onChange: (variants: Variant[]) => void
  errors?: ProductVariantErrors
  sizeOptions?: string[]
}

const emptyVariant: Variant = {
  sku: '',
  color: '',
  size: '',
  price: 0,
  cost: 0,
  stock: 0,
}

const DEFAULT_SIZE_OPTIONS = ['80', '90', '100', '110', '120', '130', '140']
const STOCK_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

// Best-effort next SKU when duplicating: increment the trailing number so the
// copy isn't an immediate duplicate. The admin can still edit it.
function bumpSku(sku: string): string {
  const match = sku.match(/^(.*?)(\d+)(\D*)$/)
  if (match) {
    const [, prefix, digits, suffix] = match
    const next = String(Number(digits) + 1).padStart(digits.length, '0')
    return `${prefix}${next}${suffix}`
  }
  return sku ? `${sku}-2` : ''
}

export function VariantGrid({ variants, onChange, errors = [], sizeOptions }: VariantGridProps) {
  const SIZE_OPTIONS = sizeOptions && sizeOptions.length > 0 ? sizeOptions : DEFAULT_SIZE_OPTIONS
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [colorsText, setColorsText] = useState('')
  const [pickedSizes, setPickedSizes] = useState<string[]>([])
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkCost, setBulkCost] = useState('')
  const [bulkStock, setBulkStock] = useState('0')
  const [skuPrefix, setSkuPrefix] = useState('')
  const [generatorNote, setGeneratorNote] = useState('')

  const colorList = parseVariantList(colorsText)
  const orderedSizes = useMemo(
    () => SIZE_OPTIONS.filter((size) => pickedSizes.includes(size)),
    [SIZE_OPTIONS, pickedSizes],
  )
  // Preview the exact rows the button will add, so the count on it is the truth.
  const preview = generateVariantMatrix({
    colors: colorList,
    sizes: orderedSizes,
    skuPrefix: skuPrefix || suggestSkuPrefix(variants),
    price: Number(bulkPrice) || 0,
    cost: Number(bulkCost) || 0,
    stock: Number(bulkStock) || 0,
    existing: withoutBlankVariants(variants),
  })

  function generate() {
    if (preview.variants.length === 0) return
    const kept = withoutBlankVariants(variants)
    onChange([...kept, ...preview.variants])
    setGeneratorNote(
      preview.skipped > 0
        ? `已新增 ${preview.variants.length} 個規格，另有 ${preview.skipped} 個組合已存在，未重複建立。`
        : `已新增 ${preview.variants.length} 個規格，往下確認售價與庫存即可。`,
    )
    setColorsText('')
    setPickedSizes([])
  }

  function update(index: number, field: keyof Variant, value: string | number | undefined) {
    onChange(variants.map((variant, variantIndex) => (
      variantIndex === index ? { ...variant, [field]: value } : variant
    )))
  }

  function duplicate(index: number) {
    const source = variants[index]
    // A duplicate is a brand-new variant: drop id/updatedAt, bump the SKU, and
    // carry over colour, prices and stock so only the size needs changing.
    const copy: Variant = { ...source, id: undefined, updatedAt: undefined, sku: bumpSku(source.sku) }
    onChange([...variants.slice(0, index + 1), copy, ...variants.slice(index + 1)])
  }

  return (
    <fieldset className="admin-variant-fieldset">
      <legend className="sr-only">商品規格</legend>
      <p className="admin-sku-help"><strong>SKU 是什麼？</strong>它是每個「顏色＋尺寸」專用的內部庫存編號，顧客不會看到。例：<code>MORI-TEE-GREEN-110</code>。填好一個後可按「複製此規格」快速新增同色不同尺寸。</p>

      <div className="admin-variant-generator" data-open={generatorOpen}>
        <button
          aria-expanded={generatorOpen}
          className="admin-variant-generator-toggle"
          onClick={() => { setGeneratorOpen((open) => !open); setGeneratorNote('') }}
          type="button"
        >
          <span><strong>批次產生規格</strong><small>輸入顏色與尺寸，一次建立所有組合並自動編 SKU</small></span>
          <span aria-hidden="true">{generatorOpen ? '收合' : '展開'}</span>
        </button>

        {generatorOpen ? (
          <div className="admin-variant-generator-body">
            <label className="admin-variant-generator-colors">
              顏色
              <input
                aria-label="批次顏色"
                onChange={(event) => setColorsText(event.target.value)}
                placeholder="例：奶油白、霧綠、淺灰（用、或逗號分隔）"
                value={colorsText}
              />
              <small>{colorList.length > 0 ? `已輸入 ${colorList.length} 種顏色` : '可一次輸入多種顏色'}</small>
            </label>

            <div className="admin-variant-generator-sizes">
              <span>尺寸</span>
              <div className="admin-variant-generator-chips">
                {SIZE_OPTIONS.map((size) => {
                  const active = pickedSizes.includes(size)
                  return (
                    <button
                      aria-pressed={active}
                      data-active={active}
                      key={size}
                      onClick={() => setPickedSizes((current) => (
                        active ? current.filter((value) => value !== size) : [...current, size]
                      ))}
                      type="button"
                    >{size}</button>
                  )
                })}
                <button
                  className="admin-variant-generator-all"
                  onClick={() => setPickedSizes(pickedSizes.length === SIZE_OPTIONS.length ? [] : [...SIZE_OPTIONS])}
                  type="button"
                >{pickedSizes.length === SIZE_OPTIONS.length ? '全部取消' : '全選'}</button>
              </div>
            </div>

            <div className="admin-variant-generator-values">
              <label>售價<input aria-label="批次售價" inputMode="numeric" min="0" onChange={(event) => setBulkPrice(event.target.value)} placeholder="0" type="number" value={bulkPrice} /></label>
              <label>成本<input aria-label="批次成本" inputMode="numeric" min="0" onChange={(event) => setBulkCost(event.target.value)} placeholder="0" type="number" value={bulkCost} /></label>
              <label>庫存<input aria-label="批次庫存" inputMode="numeric" min="0" onChange={(event) => setBulkStock(event.target.value)} placeholder="0" type="number" value={bulkStock} /></label>
              <label>SKU 前綴<input aria-label="SKU 前綴" onChange={(event) => setSkuPrefix(event.target.value)} placeholder={suggestSkuPrefix(variants)} value={skuPrefix} /></label>
            </div>

            <div className="admin-variant-generator-actions">
              <p>
                {preview.variants.length > 0
                  ? <>將產生 <strong>{preview.variants.length}</strong> 個規格{preview.skipped > 0 ? `（略過 ${preview.skipped} 個已存在的組合）` : ''}，例：<code>{preview.variants[0].sku}</code></>
                  : colorList.length === 0 || orderedSizes.length === 0
                    ? '請先輸入顏色並選擇尺寸'
                    : '這些組合都已經建立了'}
              </p>
              <button className="button" disabled={preview.variants.length === 0} onClick={generate} type="button">產生規格</button>
            </div>
          </div>
        ) : null}

        {generatorNote ? <p className="admin-variant-generator-note" role="status">{generatorNote}</p> : null}
      </div>

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
            <select
              aria-label="尺寸"
              aria-invalid={Boolean(errors[index]?.size)}
              value={variant.size}
              onChange={(event) => update(index, 'size', event.target.value)}
              required
            >
              <option value="" disabled>選擇尺寸</option>
              {SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
              {variant.size && !SIZE_OPTIONS.includes(variant.size)
                ? <option value={variant.size}>{variant.size}</option>
                : null}
            </select>
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
            <select
              aria-label="庫存"
              aria-invalid={Boolean(errors[index]?.stock)}
              value={String(variant.stock)}
              onChange={(event) => update(index, 'stock', Number(event.target.value))}
              required
            >
              {STOCK_OPTIONS.map((stock) => <option key={stock} value={stock}>{stock}</option>)}
              {STOCK_OPTIONS.includes(String(variant.stock))
                ? null
                : <option value={String(variant.stock)}>{variant.stock}</option>}
            </select>
            {errors[index]?.stock ? <small>{errors[index].stock?.[0]}</small> : null}
          </label>
          <div className="admin-variant-actions">
            <button type="button" className="admin-variant-duplicate" onClick={() => duplicate(index)}>複製此規格</button>
            <button
              type="button"
              className="admin-variant-remove"
              aria-label="移除規格"
              title="移除規格"
              onClick={() => onChange(variants.filter((_, variantIndex) => variantIndex !== index))}
              disabled={variants.length === 1}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
        </div>
      ))}
      <button aria-label="新增規格" className="admin-add-variant" type="button" onClick={() => onChange([...variants, { ...emptyVariant }])}>
        ＋ 新增顏色／尺寸規格
      </button>
    </fieldset>
  )
}
