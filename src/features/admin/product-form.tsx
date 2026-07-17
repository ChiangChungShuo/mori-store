'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { ProductInput } from '@/lib/validation/product'
import { VariantGrid } from './variant-grid'

type ProductActionResult = {
  ok: boolean
  message?: string
  productId?: string
  fieldErrors?: Record<string, string[] | undefined>
}

type ProductFormProps = {
  initialProduct: ProductInput
  onSave: (product: ProductInput) => Promise<ProductActionResult>
}

const ageBands: ProductInput['ageBands'][number][] = ['0-2', '3-5', '6-9', '10-12']

export function ProductForm({ initialProduct, onSave }: ProductFormProps) {
  const [product, setProduct] = useState(initialProduct)
  const [result, setResult] = useState<ProductActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => setResult(await onSave(product)))
  }

  function setText(field: 'name' | 'slug' | 'category' | 'description' | 'material' | 'careInstructions' | 'sizeGuide', value: string) {
    setProduct((current) => ({ ...current, [field]: value }))
  }

  function toggleAgeBand(ageBand: ProductInput['ageBands'][number], checked: boolean) {
    setProduct((current) => ({
      ...current,
      ageBands: checked
        ? [...current.ageBands, ageBand]
        : current.ageBands.filter((candidate) => candidate !== ageBand),
    }))
  }

  return (
    <form className="admin-product-form" onSubmit={submit} noValidate>
      <label>
        商品名稱
        <input
          value={product.name}
          onChange={(event) => setText('name', event.target.value)}
          required
        />
      </label>
      <label>
        網址代稱
        <input
          value={product.slug}
          onChange={(event) => setText('slug', event.target.value)}
          required
        />
      </label>
      <label>
        分類
        <input
          value={product.category}
          onChange={(event) => setText('category', event.target.value)}
          required
        />
      </label>
      <fieldset>
        <legend>適用年齡</legend>
        {ageBands.map((ageBand) => (
          <label key={ageBand}>
            <input
              type="checkbox"
              checked={product.ageBands.includes(ageBand)}
              onChange={(event) => toggleAgeBand(ageBand, event.target.checked)}
            />
            {ageBand} 歲
          </label>
        ))}
      </fieldset>
      <label>
        商品說明
        <textarea
          value={product.description}
          onChange={(event) => setText('description', event.target.value)}
        />
      </label>
      <label>
        材質
        <input
          value={product.material}
          onChange={(event) => setText('material', event.target.value)}
        />
      </label>
      <label>
        洗滌說明
        <textarea
          value={product.careInstructions}
          onChange={(event) => setText('careInstructions', event.target.value)}
        />
      </label>
      <label>
        尺寸指南
        <textarea
          value={product.sizeGuide}
          onChange={(event) => setText('sizeGuide', event.target.value)}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={product.isNew}
          onChange={(event) => setProduct((current) => ({ ...current, isNew: event.target.checked }))}
        />
        新品標記
      </label>
      <VariantGrid
        variants={product.variants}
        onChange={(variants) => setProduct((current) => ({ ...current, variants }))}
      />
      {result?.message && <p role="alert">{result.message}</p>}
      {result?.ok && <p role="status">商品已儲存</p>}
      {result?.ok && result.productId && (
        <p><Link href={`/admin/products/${result.productId}/edit`}>前往商品圖片與上架設定</Link></p>
      )}
      <button className="button" type="submit" disabled={pending}>
        {pending ? '儲存中…' : '儲存商品'}
      </button>
    </form>
  )
}
