import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CartPageClient } from '@/features/cart/cart-page-client'
import { CartProvider, useCart } from '@/features/cart/cart-provider'
import { CartDrawer } from '@/features/cart/cart-drawer'
import { cartReducer } from '@/features/cart/reducer'
import { calculateCart } from '@/features/cart/totals'
import { parseStoredCartItems, type CartItem } from '@/features/cart/types'
import { parseStorefrontSettings } from '@/features/checkout/settings'

const tee: CartItem = {
  variantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  productSlug: 'mori-organic-cotton-tee',
  name: '有機棉小樹 T 恤',
  imageUrl: null,
  color: '鼠尾草綠',
  size: '100',
  unitPrice: 680,
  quantity: 1,
  maxStock: 2,
}

const pants: CartItem = {
  variantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  productSlug: 'mori-everyday-pants',
  name: '自在長褲',
  imageUrl: '/pants.jpg',
  color: '海軍藍',
  size: '110',
  unitPrice: 880,
  quantity: 1,
  maxStock: 4,
}

const storeSettings = { shippingFee: 60, freeShippingThreshold: 1500 }

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

describe('calculateCart', () => {
  it('charges shipping below the threshold', () => {
    expect(calculateCart([{ unitPrice: 590, quantity: 2 }], 65, 1500)).toEqual({
      subtotal: 1180,
      shipping: 65,
      total: 1245,
    })
  })

  it('waives shipping at the threshold', () => {
    expect(calculateCart([{ unitPrice: 750, quantity: 2 }], 65, 1500).shipping).toBe(0)
  })

  it('does not charge shipping for an empty cart', () => {
    expect(calculateCart([], 65, 1500)).toEqual({ subtotal: 0, shipping: 0, total: 0 })
  })
})

describe('storefront settings', () => {
  it('reads configured shipping and a disabled free-shipping threshold', () => {
    expect(parseStorefrontSettings([
      { key: 'shipping_fee', value: { amount: 85 } },
      { key: 'free_shipping_threshold', value: { amount: null } },
    ])).toEqual({ shippingFee: 85, freeShippingThreshold: null })
  })

  it('rejects missing or malformed settings instead of using fallback prices', () => {
    expect(() => parseStorefrontSettings([
      { key: 'shipping_fee', value: { amount: 85 } },
    ])).toThrow('商店運費設定無效')
    expect(() => parseStorefrontSettings([
      { key: 'shipping_fee', value: { amount: -1 } },
      { key: 'free_shipping_threshold', value: { amount: 1500 } },
    ])).toThrow('商店運費設定無效')
  })
})

describe('cartReducer', () => {
  it('keeps existing items when adding a different variant', () => {
    expect(cartReducer([tee], { type: 'add', item: pants })).toEqual([tee, pants])
  })

  it('merges the same variant and caps its quantity at stock', () => {
    const once = cartReducer([], { type: 'add', item: tee })
    const threeRequested = cartReducer(once, {
      type: 'add',
      item: { ...tee, quantity: 2 },
    })

    expect(threeRequested).toEqual([{ ...tee, quantity: 2 }])
  })

  it('uses the latest metadata when adding an existing variant', () => {
    const latest = {
      ...tee,
      name: '有機棉小樹上衣',
      imageUrl: '/latest.jpg',
      color: '森林綠',
      size: '110',
      unitPrice: 720,
      quantity: 1,
      maxStock: 5,
    }

    expect(cartReducer([tee], { type: 'add', item: latest })).toEqual([
      { ...latest, quantity: 2 },
    ])
  })

  it('treats UUID case variants as one item and uses the latest metadata', () => {
    const latest = {
      ...tee,
      variantId: tee.variantId.toUpperCase(),
      name: '最新名稱',
      quantity: 2,
      maxStock: 3,
    }

    expect(cartReducer([{ ...tee, quantity: 2 }], { type: 'add', item: latest })).toEqual([
      { ...latest, variantId: tee.variantId, quantity: 3 },
    ])
  })

  it('does not add a 51st distinct variant', () => {
    const fullCart = Array.from({ length: 50 }, (_, index) => ({
      ...tee,
      variantId: `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
    }))
    const extra = {
      ...tee,
      variantId: '00000000-0000-4000-8000-000000000050',
    }

    expect(cartReducer(fullCart, { type: 'add', item: extra })).toEqual(fullCart)
  })

  it('caps setQuantity at stock and supports removing and clearing', () => {
    const capped = cartReducer([tee], {
      type: 'setQuantity',
      variantId: tee.variantId,
      quantity: 10,
    })
    const removed = cartReducer(capped, { type: 'remove', variantId: tee.variantId })

    expect(capped[0]?.quantity).toBe(2)
    expect(removed).toEqual([])
    expect(cartReducer([tee], { type: 'clear' })).toEqual([])
  })
})

describe('CartProvider', () => {
  it('hydrates multiple valid variants', async () => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([tee, pants]))

    function Names() {
      return createElement('span', null, useCart().items.map((item) => item.name).join('、'))
    }

    render(createElement(CartProvider, null, createElement(Names)))

    expect(await screen.findByText('有機棉小樹 T 恤、自在長褲')).toBeInTheDocument()
  })

  it('ignores stored entries that do not match the CartItem runtime shape', async () => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([
      tee,
      { ...pants, unitPrice: '免費' },
    ]))

    function ItemCount() {
      return createElement('span', null, useCart().items.length)
    }

    render(createElement(CartProvider, null, createElement(ItemCount)))

    expect(await screen.findByText('1')).toBeInTheDocument()
  })

  it('rejects persisted quantities and stock above the single-item limit', () => {
    expect(parseStoredCartItems([{ ...tee, quantity: 100 }])).toEqual([])
    expect(parseStoredCartItems([{ ...tee, maxStock: 100 }])).toEqual([])
  })

  it('rejects invalid persisted UUIDs and keeps at most 50 distinct items', () => {
    expect(parseStoredCartItems([{ ...tee, variantId: 'not-a-uuid' }])).toEqual([])

    const storedItems = Array.from({ length: 51 }, (_, index) => ({
      ...tee,
      variantId: `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
    }))
    expect(parseStoredCartItems(storedItems)).toHaveLength(50)
  })

  it('canonicalizes persisted IDs and merges case duplicates with current stock caps', () => {
    expect(parseStoredCartItems([
      { ...tee, quantity: 2, maxStock: 9 },
      {
        ...tee,
        variantId: tee.variantId.toUpperCase(),
        name: '最新名稱',
        quantity: 2,
        maxStock: 3,
      },
    ])).toEqual([{
      ...tee,
      name: '最新名稱',
      quantity: 3,
      maxStock: 3,
    }])
  })

  it('hydrates stored items without allowing quantity above maxStock', async () => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([{ ...tee, quantity: 99 }]))

    function Quantity() {
      return createElement('span', null, useCart().items[0]?.quantity ?? 0)
    }

    render(createElement(CartProvider, null, createElement(Quantity)))

    expect(await screen.findByText('2')).toBeInTheDocument()
  })

  it('renders hydrated items and their subtotal in the cart drawer', async () => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([tee]))
    render(createElement(CartProvider, null, createElement(CartDrawer)))

    expect(await screen.findByText('有機棉小樹 T 恤')).toBeInTheDocument()
    expect(screen.getByText('購物袋（1）')).toBeInTheDocument()
    expect(screen.getByText('小計 NT$680')).toBeInTheDocument()
  })
})

describe('CartPage refresh', () => {
  it('keeps existing items and offers retry when the server refresh fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network unavailable'))
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([tee]))

    render(createElement(CartProvider, null, createElement(CartPageClient, { settings: storeSettings })))

    expect(await screen.findByText(tee.name)).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('無法更新購物袋，請再試一次。')
    expect(screen.getByText(tee.name)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重試' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('renders at most 99 quantity options for a large-stock add action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    function AddLargeStockItem() {
      const { dispatch } = useCart()
      return createElement('button', {
        type: 'button',
        onClick: () => dispatch({
          type: 'add',
          item: { ...tee, maxStock: 120 },
        }),
      }, '加入大量庫存商品')
    }

    render(createElement(
      CartProvider,
      null,
      createElement('div', null, createElement(
        AddLargeStockItem,
      ), createElement(CartPageClient, { settings: storeSettings })),
    ))

    await screen.findByText('購物袋還是空的。')
    fireEvent.click(screen.getByRole('button', { name: '加入大量庫存商品' }))
    await screen.findByRole('alert')

    expect(within(screen.getByLabelText('數量')).getAllByRole('option')).toHaveLength(99)
  })

  it('uses server-provided shipping settings and hides disabled free shipping', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([tee]))

    render(createElement(
      CartProvider,
      null,
      createElement(CartPageClient, {
        settings: { shippingFee: 85, freeShippingThreshold: null },
      }),
    ))

    await screen.findByRole('alert')
    expect(screen.getByText('NT$85')).toBeInTheDocument()
    expect(screen.getByText('NT$765')).toBeInTheDocument()
    expect(screen.queryByText(/滿 .* 免運/)).not.toBeInTheDocument()
  })
})
