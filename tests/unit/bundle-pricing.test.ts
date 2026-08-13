import { describe, expect, it } from 'vitest'
import {
  calculateBundleDiscounts,
  describeQuantityTier,
  findNextQuantityOffer,
  normalizeQuantityTiers,
  priceProductBundle,
} from '@/features/cart/bundle-pricing'

const tee = [
  { quantity: 2, bundlePrice: 1000 },
  { quantity: 3, bundlePrice: 1350 },
]

describe('priceProductBundle', () => {
  it('leaves a single item at its unit price', () => {
    expect(priceProductBundle([{ unitPrice: 590, quantity: 1 }], tee)).toMatchObject({
      originalSubtotal: 590,
      discountedSubtotal: 590,
      discount: 0,
      appliedTiers: [],
    })
  })

  it('applies the two-item tier', () => {
    expect(priceProductBundle([{ unitPrice: 590, quantity: 2 }], tee)).toMatchObject({
      originalSubtotal: 1180,
      discountedSubtotal: 1000,
      discount: 180,
      appliedTiers: [{ quantity: 2, bundlePrice: 1000, times: 1 }],
      remainingUnits: 0,
    })
  })

  it('mixes colours and sizes of the same product into one bundle', () => {
    const result = priceProductBundle([
      { unitPrice: 590, quantity: 1 },
      { unitPrice: 590, quantity: 1 },
      { unitPrice: 590, quantity: 1 },
    ], tee)

    expect(result.discountedSubtotal).toBe(1350)
    expect(result.appliedTiers).toEqual([{ quantity: 3, bundlePrice: 1350, times: 1 }])
  })

  it('prefers three-for-1350 over two-for-1000 plus a single', () => {
    // 1000 + 590 = 1590 vs 1350 — the three-item tier wins.
    expect(priceProductBundle([{ unitPrice: 590, quantity: 3 }], tee).discountedSubtotal).toBe(1350)
  })

  it('combines tiers for larger quantities', () => {
    // 5 units: 3-for-1350 + 2-for-1000 = 2350, cheaper than 2+2+single (2590).
    const result = priceProductBundle([{ unitPrice: 590, quantity: 5 }], tee)
    expect(result.discountedSubtotal).toBe(2350)
    expect(result.appliedTiers).toEqual([
      { quantity: 3, bundlePrice: 1350, times: 1 },
      { quantity: 2, bundlePrice: 1000, times: 1 },
    ])
  })

  it('leaves a unit unbundled when that beats two pairs', () => {
    // 3-for-1350 + one at 590 = 1940 beats two pairs at 2000.
    const result = priceProductBundle([{ unitPrice: 590, quantity: 4 }], tee)
    expect(result.discountedSubtotal).toBe(1940)
    expect(result.appliedTiers).toEqual([{ quantity: 3, bundlePrice: 1350, times: 1 }])
    expect(result.remainingUnits).toBe(1)
  })

  it('uses two pairs when no cheaper mix exists', () => {
    const result = priceProductBundle([{ unitPrice: 590, quantity: 4 }], [
      { quantity: 2, bundlePrice: 1000 },
    ])
    expect(result.discountedSubtotal).toBe(2000)
    expect(result.appliedTiers).toEqual([{ quantity: 2, bundlePrice: 1000, times: 2 }])
  })

  it('puts the most expensive units into the bundle', () => {
    // 2-for-1000 should cover the two 700s, leaving the 400 at unit price.
    const result = priceProductBundle([
      { unitPrice: 700, quantity: 2 },
      { unitPrice: 400, quantity: 1 },
    ], [{ quantity: 2, bundlePrice: 1000 }])

    expect(result.originalSubtotal).toBe(1800)
    expect(result.discountedSubtotal).toBe(1400)
    expect(result.remainingUnits).toBe(1)
  })

  it('never charges more than the unit-price total', () => {
    const result = priceProductBundle([{ unitPrice: 300, quantity: 2 }], [
      { quantity: 2, bundlePrice: 900 },
    ])

    expect(result.discountedSubtotal).toBe(600)
    expect(result.discount).toBe(0)
    expect(result.appliedTiers).toEqual([])
  })

  it('skips a tier the cart cannot reach', () => {
    expect(priceProductBundle([{ unitPrice: 590, quantity: 2 }], [
      { quantity: 5, bundlePrice: 2000 },
    ]).discount).toBe(0)
  })

  it('ignores tiers below two items and negative prices', () => {
    expect(priceProductBundle([{ unitPrice: 590, quantity: 2 }], [
      { quantity: 1, bundlePrice: 100 },
      { quantity: 2, bundlePrice: -50 },
    ]).discount).toBe(0)
  })

  it('returns an empty result for an empty cart', () => {
    expect(priceProductBundle([], tee)).toMatchObject({ originalSubtotal: 0, discount: 0 })
  })

  it('handles a large quantity without blowing up', () => {
    const result = priceProductBundle([{ unitPrice: 590, quantity: 99 }], tee)
    // 33 three-packs is the cheapest cover of 99 units.
    expect(result.discountedSubtotal).toBe(33 * 1350)
    expect(result.remainingUnits).toBe(0)
  })
})

describe('normalizeQuantityTiers', () => {
  it('keeps the cheapest price per quantity and sorts ascending', () => {
    expect(normalizeQuantityTiers([
      { quantity: 3, bundlePrice: 1400 },
      { quantity: 2, bundlePrice: 1000 },
      { quantity: 3, bundlePrice: 1350 },
    ])).toEqual([
      { quantity: 2, bundlePrice: 1000 },
      { quantity: 3, bundlePrice: 1350 },
    ])
  })

  it('drops tiers with a non-integer or too-small quantity', () => {
    expect(normalizeQuantityTiers([
      { quantity: 1, bundlePrice: 500 },
      { quantity: 2.5, bundlePrice: 900 },
      { quantity: 0, bundlePrice: 0 },
    ])).toEqual([])
  })
})

describe('calculateBundleDiscounts', () => {
  it('prices each product against its own tiers', () => {
    const result = calculateBundleDiscounts([
      { productKey: 'tee', unitPrice: 590, quantity: 2 },
      { productKey: 'pants', unitPrice: 800, quantity: 2 },
    ], {
      tee,
      pants: [{ quantity: 2, bundlePrice: 1500 }],
    })

    expect(result.discount).toBe(180 + 100)
    expect(result.byProduct.get('tee')?.discountedSubtotal).toBe(1000)
    expect(result.byProduct.get('pants')?.discountedSubtotal).toBe(1500)
  })

  it('does not pool quantities across different products', () => {
    const result = calculateBundleDiscounts([
      { productKey: 'tee', unitPrice: 590, quantity: 1 },
      { productKey: 'pants', unitPrice: 590, quantity: 1 },
    ], { tee, pants: tee })

    expect(result.discount).toBe(0)
    expect(result.byProduct.size).toBe(0)
  })

  it('ignores products with no tiers', () => {
    const result = calculateBundleDiscounts([
      { productKey: 'socks', unitPrice: 200, quantity: 4 },
    ], {})

    expect(result.discount).toBe(0)
  })
})

describe('describeQuantityTier', () => {
  it('describes the saving against the unit price', () => {
    expect(describeQuantityTier({ quantity: 2, bundlePrice: 1000 }, 590)).toEqual({
      quantity: 2,
      bundlePrice: 1000,
      saving: 180,
      perUnit: 500,
      label: '任選 2 件',
    })
  })

  it('never reports a negative saving', () => {
    expect(describeQuantityTier({ quantity: 2, bundlePrice: 900 }, 300).saving).toBe(0)
  })
})

describe('findNextQuantityOffer', () => {
  it('finds the nearest real offer without pooling different products', () => {
    expect(findNextQuantityOffer([
      { productKey: 'tee', unitPrice: 590, quantity: 1 },
      { productKey: 'pants', unitPrice: 800, quantity: 1 },
    ], {
      tee,
      pants: [{ quantity: 3, bundlePrice: 2200 }],
    })).toEqual({
      productKey: 'tee',
      currentQuantity: 1,
      targetQuantity: 2,
      remainingQuantity: 1,
      saving: 180,
    })
  })

  it('ignores a tier that does not actually save money', () => {
    expect(findNextQuantityOffer([
      { productKey: 'tee', unitPrice: 300, quantity: 1 },
    ], {
      tee: [{ quantity: 2, bundlePrice: 700 }],
    })).toBeNull()
  })
})
