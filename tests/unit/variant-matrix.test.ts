import { describe, expect, it } from 'vitest'
import {
  generateVariantMatrix,
  parseVariantList,
  suggestSkuPrefix,
  variantSkuCode,
  withoutBlankVariants,
} from '@/features/admin/variant-matrix'

describe('parseVariantList', () => {
  it('splits on 、, ，and line breaks, trimming and de-duplicating', () => {
    expect(parseVariantList('奶油白、霧綠, 淺灰\n奶油白 ，')).toEqual(['奶油白', '霧綠', '淺灰'])
    expect(parseVariantList('   ')).toEqual([])
  })
})

describe('variantSkuCode', () => {
  it('keeps latin colour names and numbers the rest by position', () => {
    expect(variantSkuCode('Cream White', 0)).toBe('CREAMWHITE')
    expect(variantSkuCode('霧綠', 1)).toBe('02')
  })
})

describe('suggestSkuPrefix', () => {
  it('reuses the head of an existing SKU, or falls back', () => {
    expect(suggestSkuPrefix([{ sku: 'mori-tee-green-110', color: '綠', size: '110' }])).toBe('MORI-TEE')
    expect(suggestSkuPrefix([{ sku: '', color: '', size: '' }])).toBe('MORI')
  })
})

describe('generateVariantMatrix', () => {
  const base = { skuPrefix: 'MORI-TEE', price: 680, cost: 240, stock: 3 }

  it('builds every colour × size combination with unique SKUs', () => {
    const { variants, skipped } = generateVariantMatrix({
      ...base,
      colors: ['米白', '霧綠'],
      sizes: ['100', '110'],
      existing: [],
    })

    expect(skipped).toBe(0)
    expect(variants.map((variant) => variant.sku)).toEqual([
      'MORI-TEE-01-100', 'MORI-TEE-01-110', 'MORI-TEE-02-100', 'MORI-TEE-02-110',
    ])
    expect(variants.map((variant) => `${variant.color}/${variant.size}`)).toEqual([
      '米白/100', '米白/110', '霧綠/100', '霧綠/110',
    ])
    expect(variants.every((variant) => variant.price === 680 && variant.cost === 240 && variant.stock === 3)).toBe(true)
  })

  it('leaves combinations that already exist alone', () => {
    const { variants, skipped } = generateVariantMatrix({
      ...base,
      colors: ['米白'],
      sizes: ['100', '110'],
      existing: [{ sku: 'OLD-100', color: '米白', size: '100' }],
    })

    expect(skipped).toBe(1)
    expect(variants).toHaveLength(1)
    expect(variants[0].size).toBe('110')
  })

  it('never repeats a SKU that is already taken', () => {
    const { variants } = generateVariantMatrix({
      ...base,
      colors: ['米白'],
      sizes: ['100'],
      existing: [{ sku: 'MORI-TEE-01-100', color: '霧綠', size: '100' }],
    })

    expect(variants[0].sku).toBe('MORI-TEE-01-100-2')
  })

  it('ignores blank input rather than generating empty rows', () => {
    expect(generateVariantMatrix({ ...base, colors: ['  '], sizes: ['100'], existing: [] }).variants).toEqual([])
    expect(generateVariantMatrix({ ...base, colors: ['米白'], sizes: [], existing: [] }).variants).toEqual([])
  })
})

describe('withoutBlankVariants', () => {
  it('drops the untouched starter row but keeps partly filled ones', () => {
    const rows = [
      { sku: '', color: '', size: '', price: 0, cost: 0, stock: 0 },
      { sku: '', color: '米白', size: '', price: 0, cost: 0, stock: 0 },
    ]
    expect(withoutBlankVariants(rows)).toEqual([rows[1]])
  })
})
