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
import type { CatalogProduct } from '@/features/catalog/queries'

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

const suggestedProduct: CatalogProduct = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  slug: 'mori-cloud-romper',
  name: '雲朵包屁衣',
  description: '柔軟日常包屁衣',
  category: '包屁衣',
  series: [],
  ageBands: ['0-3'],
  material: '棉',
  careInstructions: '冷水洗滌',
  sizeGuide: '70–80',
  isNew: true,
  imageUrl: null,
  imageAlt: '雲朵包屁衣',
  variants: [{
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    sku: 'MORI-CLOUD-70',
    color: '雲朵米',
    size: '70',
    price: 580,
    compareAtPrice: null,
    stock: 5,
  }],
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('calculateCart', () => {
  it('charges shipping below the threshold', () => {
    expect(calculateCart([{ unitPrice: 590, quantity: 2 }], 65, 1500)).toMatchObject({
      subtotal: 1180,
      bundleDiscount: 0,
      shipping: 65,
      total: 1245,
    })
  })

  it('waives shipping at the threshold', () => {
    expect(calculateCart([{ unitPrice: 750, quantity: 2 }], 65, 1500).shipping).toBe(0)
  })

  it('does not charge shipping for an empty cart', () => {
    expect(calculateCart([], 65, 1500)).toMatchObject({ subtotal: 0, shipping: 0, total: 0 })
  })

  it('applies quantity tiers and judges free shipping on the discounted total', () => {
    const items = [{ productSlug: 'tee', unitPrice: 590, quantity: 3 }]
    const tiers = { tee: [{ quantity: 3, bundlePrice: 1350 }] }

    // 1770 would clear a 1500 threshold, but the bundle price of 1350 does not.
    expect(calculateCart(items, 65, 1500, tiers)).toMatchObject({
      subtotal: 1770,
      bundleDiscount: 420,
      discountedSubtotal: 1350,
      shipping: 65,
      total: 1415,
    })
  })

  it('ignores tiers for products that are not in the cart', () => {
    expect(calculateCart(
      [{ productSlug: 'tee', unitPrice: 590, quantity: 1 }],
      65,
      1500,
      { pants: [{ quantity: 2, bundlePrice: 900 }] },
    ).bundleDiscount).toBe(0)
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
    render(createElement(CartProvider, null, createElement(CartDrawer, { settings: storeSettings })))

    expect(await screen.findByText('有機棉小樹 T 恤')).toBeInTheDocument()
    expect(screen.getAllByText('購物車')).toHaveLength(2)
    expect(screen.getByLabelText('1 件商品')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '有機棉小樹 T 恤' })).toBeInTheDocument()
    expect(screen.getByText('鼠尾草綠／尺寸 100')).toBeInTheDocument()
    expect(screen.getByText('商品小計').closest('p')).toHaveTextContent('商品小計NT$680')
    expect(screen.getByText('運費').closest('p')).toHaveTextContent('運費NT$60')
    expect(screen.getByText('合計').closest('p')).toHaveTextContent('合計NT$740')
    expect(screen.getByLabelText('免運進度 45%')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '前往結帳' })).toHaveAttribute('href', '/checkout')
  })

  it('opens after adding an item and updates quantity and totals in place', async () => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([pants]))
    render(createElement(CartProvider, null, createElement(CartDrawer, { settings: storeSettings })))

    await screen.findByText('自在長褲')
    window.dispatchEvent(new CustomEvent('mori:cart-added'))

    await waitFor(() => expect(screen.getByRole('group', { name: '購物車內容' })).toHaveAttribute('open'))
    fireEvent.click(screen.getByRole('button', { name: '增加 自在長褲 數量' }))
    expect(screen.getByRole('status', { name: '自在長褲 數量' })).toHaveTextContent('2')
    expect(screen.getByText('商品小計').closest('p')).toHaveTextContent('商品小計NT$1,760')
    expect(screen.getByText('運費').closest('p')).toHaveTextContent('運費免運')
    expect(screen.getByText('合計').closest('p')).toHaveTextContent('合計NT$1,760')
  })
})

describe('CartPage refresh', () => {
  it('applies a coupon in the cart and shows product suggestions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([tee]))
    const couponAction = vi.fn().mockResolvedValue({
      ok: true,
      code: 'HELLOMORI',
      discount: 100,
      message: '已套用 HELLOMORI，折抵 NT$100。',
    })

    render(createElement(CartProvider, null, createElement(CartPageClient, {
      settings: storeSettings,
      recommendedProducts: [suggestedProduct],
      couponAction,
    })))

    await screen.findByRole('alert')
    fireEvent.change(screen.getByLabelText('優惠碼'), { target: { value: 'hellomori' } })
    fireEvent.click(screen.getByRole('button', { name: '套用' }))

    expect(await screen.findByText('已套用 HELLOMORI，折抵 NT$100。')).toBeInTheDocument()
    expect(couponAction).toHaveBeenCalledWith('HELLOMORI', 680)
    expect(screen.getByText('NT$640')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '您可能喜歡' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: suggestedProduct.name })).toHaveAttribute('href', '/products/mori-cloud-romper')
  })

  it('does not ask a signed-in member to log in again', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([tee]))

    render(createElement(CartProvider, null, createElement(CartPageClient, {
      settings: storeSettings,
      isSignedIn: true,
    })))

    await screen.findByRole('alert')
    expect(screen.queryByRole('region', { name: '會員登入提示' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '登入' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '前往結帳' })).toHaveAttribute('href', '/checkout')
  })

  it('updates quantity, line total, shipping and total through the stepper', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([pants]))
    render(createElement(CartProvider, null, createElement(CartPageClient, { settings: storeSettings })))
    await screen.findByText(pants.name)

    fireEvent.click(screen.getByRole('button', { name: `增加 ${pants.name} 數量` }))
    const quantity = screen.getByRole('status', { name: `${pants.name} 數量` })
    expect(quantity).toHaveTextContent('2')
    expect(quantity).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('NT$1,760', { selector: '.cart-line-total' })).toBeInTheDocument()
    const summary = screen.getByRole('complementary', { name: '訂單摘要' })
    expect(within(summary).getByText('商品小計').closest('p')).toHaveTextContent('商品小計NT$1,760')
    expect(within(summary).getByText('運費').closest('p')).toHaveTextContent('運費免運')
    expect(summary.querySelector('.cart-total')).toHaveTextContent('合計NT$1,760')

    fireEvent.click(screen.getByRole('button', { name: `減少 ${pants.name} 數量` }))
    expect(screen.getByRole('status', { name: `${pants.name} 數量` })).toHaveTextContent('1')
    expect(screen.getByText('NT$880', { selector: '.cart-line-total' })).toBeInTheDocument()
    expect(within(summary).getByText('商品小計').closest('p')).toHaveTextContent('商品小計NT$880')
    expect(within(summary).getByText('運費').closest('p')).toHaveTextContent('運費NT$60')
    expect(summary.querySelector('.cart-total')).toHaveTextContent('合計NT$940')
  })

  it('shows product imagery, quantity controls and a clear-cart action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([pants]))

    render(createElement(CartProvider, null, createElement(CartPageClient, { settings: storeSettings })))

    await screen.findByRole('alert')
    expect(screen.getByRole('img', { name: pants.name })).toHaveAttribute('src', pants.imageUrl)
    expect(screen.getByRole('button', { name: `減少 ${pants.name} 數量` })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: `增加 ${pants.name} 數量` }))
    expect(screen.getByLabelText(`${pants.name} 數量`)).toHaveTextContent('2')
    fireEvent.click(screen.getByRole('button', { name: '清空購物車' }))
    expect(await screen.findByText('購物車目前是空的。')).toBeInTheDocument()
  })

  it('keeps existing items and offers retry when the server refresh fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network unavailable'))
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([tee]))

    render(createElement(CartProvider, null, createElement(CartPageClient, { settings: storeSettings })))

    expect(await screen.findByText(tee.name)).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('無法更新購物車，請再試一次。')
    expect(screen.getByText(tee.name)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重試' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('disables quantity increase at the 99 item limit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([{
      ...tee,
      quantity: 99,
      maxStock: 99,
    }]))
    render(createElement(CartProvider, null, createElement(CartPageClient, { settings: storeSettings })))
    await screen.findByRole('alert')

    expect(screen.getByLabelText(`${tee.name} 數量`)).toHaveTextContent('99')
    expect(screen.getByRole('button', { name: `增加 ${tee.name} 數量` })).toBeDisabled()
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
