import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/cart/refresh/route'
import * as cartRefresh from '@/features/cart/refresh'
import { reconcileCartItems, type CartVariantSnapshot } from '@/features/cart/refresh'
import {
  canonicalizeCartVariantId,
  MAX_CART_ITEMS,
  type CartItem,
} from '@/features/cart/types'

const firstUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const secondUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

afterEach(() => {
  vi.unstubAllEnvs()
})

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

  it('caps refreshed high stock at the single-item purchase limit', () => {
    expect(reconcileCartItems(
      [{ variantId: staleTee.variantId, quantity: 99 }],
      [{ ...freshTee, maxStock: 120 }],
    )).toEqual([{ ...freshTee, maxStock: 99, quantity: 99 }])
  })
})

describe('parseCartRefreshRequest', () => {
  it('refreshes variants belonging to different fixture products', async () => {
    vi.stubEnv('MORI_E2E_FIXTURES', '1')

    const response = await POST(new Request('http://localhost/api/cart/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [
          { variantId: '00000000-0000-4000-8000-000000000001', quantity: 1 },
          { variantId: '00000000-0000-4000-8000-000000000101', quantity: 1 },
        ],
      }),
    }))

    const result = await response.json()
    expect(result.items.map((item: CartItem) => item.name)).toEqual([
      '有機棉小樹 T 恤', '雲朵包屁衣',
    ])
  })

  it('uses the cart-wide item limit and UUID canonicalizer', () => {
    expect(MAX_CART_ITEMS).toBe(50)
    expect(canonicalizeCartVariantId(firstUuid.toUpperCase())).toBe(firstUuid)
    expect(canonicalizeCartVariantId('not-a-uuid')).toBeNull()
  })

  it('accepts only variant IDs with positive integer quantities', () => {
    const parseCartRefreshRequest = (
      cartRefresh as unknown as {
        parseCartRefreshRequest?: (value: unknown) => Array<{ variantId: string; quantity: number }> | null
      }
    ).parseCartRefreshRequest

    expect(parseCartRefreshRequest).toBeTypeOf('function')
    if (!parseCartRefreshRequest) return

    expect(parseCartRefreshRequest({
      items: [{ variantId: firstUuid, quantity: 2 }],
    })).toEqual([{ variantId: firstUuid, quantity: 2 }])
    expect(parseCartRefreshRequest({
      items: [{ variantId: firstUuid, quantity: 0 }],
    })).toBeNull()
    expect(parseCartRefreshRequest({
      items: [{ variantId: firstUuid, quantity: 100 }],
    })).toBeNull()
    expect(parseCartRefreshRequest({ items: 'not-an-array' })).toBeNull()
  })

  it('rejects invalid UUIDs before querying variants', () => {
    expect(cartRefresh.parseCartRefreshRequest({
      items: [{ variantId: 'not-a-uuid', quantity: 1 }],
    })).toBeNull()
  })

  it('rejects requests containing more than 50 raw items', () => {
    const items = Array.from({ length: MAX_CART_ITEMS + 1 }, (_, index) => ({
      variantId: `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
      quantity: 1,
    }))

    expect(cartRefresh.parseCartRefreshRequest({ items })).toBeNull()
  })

  it('deduplicates variant IDs before they reach Supabase', () => {
    expect(cartRefresh.parseCartRefreshRequest({
      items: [
        { variantId: firstUuid, quantity: 2 },
        { variantId: secondUuid, quantity: 1 },
        { variantId: firstUuid.toUpperCase(), quantity: 9 },
      ],
    })).toEqual([
      { variantId: firstUuid, quantity: 2 },
      { variantId: secondUuid, quantity: 1 },
    ])
  })

  it('returns 400 at the route boundary for an invalid body', async () => {
    const response = await POST(new Request('http://localhost/api/cart/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ variantId: 'not-a-uuid', quantity: 1 }] }),
    }))

    expect(response.status).toBe(400)
  })
})
