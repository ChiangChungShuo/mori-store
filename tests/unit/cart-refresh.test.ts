import { describe, expect, it } from 'vitest'
import * as cartRefresh from '@/features/cart/refresh'
import { reconcileCartItems, type CartVariantSnapshot } from '@/features/cart/refresh'
import type { CartItem } from '@/features/cart/types'

const staleTee: CartItem = {
  variantId: 'variant-sage-100',
  productSlug: 'old-slug',
  name: '舊名稱',
  imageUrl: null,
  color: '舊顏色',
  size: '90',
  unitPrice: 1,
  quantity: 4,
  maxStock: 9,
}

const stalePants: CartItem = {
  ...staleTee,
  variantId: 'variant-blue-110',
  quantity: 1,
}

const freshTee: CartVariantSnapshot = {
  variantId: staleTee.variantId,
  productSlug: 'mori-organic-cotton-tee',
  name: '有機棉小樹 T 恤',
  imageUrl: '/tee.jpg',
  color: '鼠尾草綠',
  size: '100',
  unitPrice: 720,
  maxStock: 2,
}

describe('reconcileCartItems', () => {
  it('removes missing variants, refreshes metadata and caps quantity at current stock', () => {
    const missing: CartItem = { ...staleTee, variantId: 'removed-variant' }

    expect(reconcileCartItems([staleTee, stalePants, missing], [
      freshTee,
      {
        ...freshTee,
        variantId: stalePants.variantId,
        productSlug: 'mori-everyday-pants',
        name: '自在長褲',
        maxStock: 3,
      },
    ])).toEqual([
      { ...freshTee, quantity: 2 },
      {
        ...freshTee,
        variantId: stalePants.variantId,
        productSlug: 'mori-everyday-pants',
        name: '自在長褲',
        maxStock: 3,
        quantity: 1,
      },
    ])
  })

  it('removes variants that no longer have stock', () => {
    expect(reconcileCartItems([staleTee], [{ ...freshTee, maxStock: 0 }])).toEqual([])
  })
})

describe('parseCartRefreshRequest', () => {
  it('accepts only variant IDs with positive integer quantities', () => {
    const parseCartRefreshRequest = (
      cartRefresh as unknown as {
        parseCartRefreshRequest?: (value: unknown) => Array<{ variantId: string; quantity: number }> | null
      }
    ).parseCartRefreshRequest

    expect(parseCartRefreshRequest).toBeTypeOf('function')
    if (!parseCartRefreshRequest) return

    expect(parseCartRefreshRequest({
      items: [{ variantId: 'variant-sage-100', quantity: 2 }],
    })).toEqual([{ variantId: 'variant-sage-100', quantity: 2 }])
    expect(parseCartRefreshRequest({
      items: [{ variantId: 'variant-sage-100', quantity: 0 }],
    })).toBeNull()
    expect(parseCartRefreshRequest({ items: 'not-an-array' })).toBeNull()
  })
})
