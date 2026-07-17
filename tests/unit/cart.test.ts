import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CartProvider, useCart } from '@/features/cart/cart-provider'
import { CartDrawer } from '@/features/cart/cart-drawer'
import { cartReducer } from '@/features/cart/reducer'
import { calculateCart } from '@/features/cart/totals'
import type { CartItem } from '@/features/cart/types'

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

afterEach(() => {
  cleanup()
  window.localStorage.clear()
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
  it('merges the same variant and caps its quantity at stock', () => {
    const once = cartReducer([], { type: 'add', item: tee })
    const threeRequested = cartReducer(once, {
      type: 'add',
      item: { ...tee, quantity: 2 },
    })

    expect(threeRequested).toEqual([{ ...tee, quantity: 2 }])
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
