// Bulk variant generation: every colour × every size in one go, with SKUs the
// admin does not have to invent. Kept as pure functions so the rules (skip
// combinations that already exist, never repeat a SKU) can be tested directly.

import type { ProductInput } from '@/lib/validation/product'

type Variant = ProductInput['variants'][number]
type ExistingVariant = Pick<Variant, 'sku' | 'color' | 'size'>

/** Splits a 顏色 list typed with 、 , ，or line breaks, trimmed and de-duplicated. */
export function parseVariantList(text: string): string[] {
  const parts = text
    .split(/[、,，\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
  return [...new Set(parts)]
}

/**
 * SKU fragment for a colour. Latin names keep their letters (綠 GREEN → GREEN);
 * Chinese names have no useful transliteration, so they fall back to a stable
 * position number the admin can still recognise in the grid.
 */
export function variantSkuCode(value: string, index: number): string {
  const ascii = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return ascii || String(index + 1).padStart(2, '0')
}

/** Prefix suggestion: the shared head of the SKUs already on the product. */
export function suggestSkuPrefix(existing: ExistingVariant[], fallback = 'MORI'): string {
  const first = existing.find((variant) => variant.sku.trim())?.sku.trim().toUpperCase()
  if (!first) return fallback
  const head = first.split('-').slice(0, 2).join('-')
  return head || fallback
}

export function combinationKey(color: string, size: string) {
  return `${color.trim()}::${size.trim()}`
}

export type VariantMatrixOptions = {
  colors: string[]
  sizes: string[]
  skuPrefix: string
  price: number
  cost?: number
  stock: number
  existing: ExistingVariant[]
}

/**
 * Returns the variants to append. Combinations already on the product are left
 * alone — regenerating after adding one more colour must not wipe the prices and
 * stock the admin already typed.
 */
export function generateVariantMatrix(options: VariantMatrixOptions): {
  variants: Variant[]
  skipped: number
} {
  const colors = options.colors.map((color) => color.trim()).filter(Boolean)
  const sizes = options.sizes.map((size) => size.trim()).filter(Boolean)
  const taken = new Set(options.existing.map((variant) => combinationKey(variant.color, variant.size)))
  const usedSkus = new Set(options.existing.map((variant) => variant.sku.trim().toUpperCase()).filter(Boolean))
  const prefix = options.skuPrefix.trim().toUpperCase().replace(/-+$/, '')

  const variants: Variant[] = []
  let skipped = 0

  for (const [colorIndex, color] of colors.entries()) {
    for (const size of sizes) {
      if (taken.has(combinationKey(color, size))) {
        skipped += 1
        continue
      }
      const base = [prefix, variantSkuCode(color, colorIndex), size].filter(Boolean).join('-')
      let sku = base
      let attempt = 2
      while (usedSkus.has(sku.toUpperCase())) {
        sku = `${base}-${attempt}`
        attempt += 1
      }
      usedSkus.add(sku.toUpperCase())
      taken.add(combinationKey(color, size))
      variants.push({
        sku,
        color,
        size,
        price: options.price,
        cost: options.cost ?? 0,
        stock: options.stock,
      })
    }
  }

  return { variants, skipped }
}

/** Drops the rows the admin never filled in, so generating into a blank form
 * doesn't leave an empty first spec behind. */
export function withoutBlankVariants(variants: Variant[]): Variant[] {
  return variants.filter((variant) => variant.sku.trim() || variant.color.trim() || variant.size.trim())
}
