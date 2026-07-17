import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CartPage from '@/app/(store)/cart/page'
import { CartProvider, useCart } from '@/features/cart/cart-provider'
import { CartDrawer } from '@/features/cart/cart-drawer'
import { cartReducer } from '@/features/cart/reducer'
import { calculateCart } from '@/features/cart/totals'
import { parseStoredCartItems, type CartItem } from '@/features/cart/types'

const tee: CartItem = {
  variantId: 'variant-sage-100',
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
  variantId: 'variant-blue-110',
  productSlug: 'mori-everyday-pants',
  name: '自在長褲',
  imageUrl: '/pants.jpg',
  color: '海軍藍',
  size: '110',
  unitPrice: 880,
  quantity: 1,
  maxStock: 4,
}

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

    render(createElement(CartProvider, null, createElement(CartPage)))

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
      createElement('div', null, createElement(AddLargeStockItem), createElement(CartPage)),
    ))

    await screen.findByText('購物袋還是空的。')
    fireEvent.click(screen.getByRole('button', { name: '加入大量庫存商品' }))
    await screen.findByRole('alert')

    expect(within(screen.getByLabelText('數量')).getAllByRole('option')).toHaveLength(99)
  })
})
