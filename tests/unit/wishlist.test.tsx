import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { WishlistButton } from '@/features/wishlist/wishlist-button'
import { WishlistList } from '@/features/wishlist/wishlist-list'
import { WishlistAuthProvider } from '@/features/wishlist/wishlist-auth'
import { CartProvider } from '@/features/cart/cart-provider'

// JSX rather than createElement: children is a required prop, so passing it
// positionally fails typecheck and passing it in props trips react/no-children-prop.
const signedIn = (node: ReactNode) => (
  <WishlistAuthProvider isSignedIn><CartProvider>{node}</CartProvider></WishlistAuthProvider>
)

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('WishlistButton', () => {
  it('lays saved items out as catalog cards with their own buy action', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')

    expect(styles).toMatch(/\.wishlist-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4/)
    expect(styles).toMatch(/\.wishlist-item-actions\s*\{/)
    expect(styles).toMatch(/\.wishlist-size-chip\s*\{/)
    expect(styles).toMatch(/\.wishlist-shipping\s*\{/)
  })

  it('sends a saved single-colour product to the cart without leaving the page', async () => {
    window.localStorage.setItem('mori-wishlist', JSON.stringify(['product-1']))
    const product = {
      id: 'product-1', slug: 'tree-tee', name: '小樹 T 恤', description: '柔軟上衣', category: '上衣', series: [],
      ageBands: ['3-6'] as const, material: '棉', careInstructions: '冷水洗', sizeGuide: '正常版', isNew: false,
      imageUrl: null, imageAlt: '小樹 T 恤',
      variants: [
        { id: '11111111-1111-4111-8111-111111111100', sku: 'TREE-100', color: '綠', size: '100', price: 680, compareAtPrice: null, stock: 4 },
        { id: '11111111-1111-4111-8111-111111111110', sku: 'TREE-110', color: '綠', size: '110', price: 680, compareAtPrice: null, stock: 2 },
      ],
    }

    render(signedIn(createElement(WishlistList, { products: [product], freeShippingThreshold: 2000 })))

    await screen.findByRole('heading', { name: '小樹 T 恤' })
    expect(screen.getByText('合計再 NT$1,320 即可免運')).toBeInTheDocument()
    // The cart provider hydrates from storage on a timer and replaces its state
    // when it does, so wait for that before dispatching an add.
    await waitFor(() => expect(window.localStorage.getItem('mori-cart-v1')).not.toBeNull())

    // Size is unset, so the buy button waits for a choice.
    const buyButton = screen.getByRole('button', { name: '選擇尺寸' })
    expect(buyButton).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '110' }))
    const addButton = await screen.findByRole('button', { name: '加入購物車' })
    fireEvent.click(addButton)

    await waitFor(() => expect(screen.getByRole('button', { name: '已在購物車' })).toBeDisabled())
    const stored = JSON.parse(window.localStorage.getItem('mori-cart-v1') ?? '[]')
    expect(stored).toMatchObject([
      { variantId: '11111111-1111-4111-8111-111111111110', size: '110', quantity: 1, unitPrice: 680 },
    ])
  })

  it('keeps multi-colour products on the product page where colour can be chosen', async () => {
    window.localStorage.setItem('mori-wishlist', JSON.stringify(['product-2']))
    const product = {
      id: 'product-2', slug: 'cloud-romper', name: '雲朵包屁衣', description: '包屁衣', category: '幼兒服', series: [],
      ageBands: ['0-3'] as const, material: '棉', careInstructions: '冷水洗', sizeGuide: '正常版', isNew: false,
      imageUrl: null, imageAlt: '雲朵包屁衣',
      variants: [
        { id: '22222222-2222-4222-8222-222222222201', sku: 'CLOUD-70-CREAM', color: '雲朵米', size: '70', price: 580, compareAtPrice: null, stock: 3 },
        { id: '22222222-2222-4222-8222-222222222202', sku: 'CLOUD-70-SAGE', color: '鼠尾草綠', size: '70', price: 580, compareAtPrice: null, stock: 3 },
      ],
    }

    render(signedIn(createElement(WishlistList, { products: [product] })))

    await screen.findByRole('heading', { name: '雲朵包屁衣' })
    expect(screen.getByRole('link', { name: '選擇顏色與尺寸' })).toHaveAttribute('href', '/products/cloud-romper')
    expect(screen.queryByRole('button', { name: '加入購物車' })).toBeNull()
  })

  it('adds and removes a product from the browser wishlist', async () => {
    render(signedIn(createElement(WishlistButton, {
      productId: 'product-1',
      productName: '有機棉小樹 T 恤',
    })))

    const addButton = await screen.findByRole('button', { name: '收藏 有機棉小樹 T 恤' })
    fireEvent.click(addButton)

    await waitFor(() => expect(screen.getByRole('button', { name: '移除 有機棉小樹 T 恤' })).toHaveAttribute('aria-pressed', 'true'))
    expect(JSON.parse(window.localStorage.getItem('mori-wishlist') ?? '[]')).toEqual(['product-1'])

    fireEvent.click(screen.getByRole('button', { name: '移除 有機棉小樹 T 恤' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '收藏 有機棉小樹 T 恤' })).toHaveAttribute('aria-pressed', 'false'))
    expect(JSON.parse(window.localStorage.getItem('mori-wishlist') ?? '[]')).toEqual([])
  })
})
