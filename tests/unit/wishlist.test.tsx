import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { WishlistButton } from '@/features/wishlist/wishlist-button'
import { WishlistList } from '@/features/wishlist/wishlist-list'
import { WishlistAuthProvider } from '@/features/wishlist/wishlist-auth'

const signedIn = (node: ReactNode) => createElement(WishlistAuthProvider, { isSignedIn: true, children: node })

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('WishlistButton', () => {
  it('does not paint an empty grid cell when the saved product count is odd', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')

    expect(styles).toMatch(/\.wishlist-grid\s*\{[^}]*background:\s*transparent/)
    expect(styles).toMatch(/\.wishlist-grid article\s*\{[^}]*border-bottom:/)
    expect(styles).toMatch(/\.wishlist-panel\s*\{[^}]*min-height:\s*0/)
  })

  it('uses a single content-sized column when only one product is saved', async () => {
    window.localStorage.setItem('mori-wishlist', JSON.stringify(['product-1']))
    const product = {
      id: 'product-1', slug: 'tree-tee', name: '小樹 T 恤', description: '柔軟上衣', category: '上衣', series: [],
      ageBands: ['3-6'] as const, material: '棉', careInstructions: '冷水洗', sizeGuide: '正常版', isNew: false,
      imageUrl: null, imageAlt: '小樹 T 恤', variants: [{ id: 'v1', sku: 'TREE-100', color: '綠', size: '100', price: 680, compareAtPrice: null, stock: 1 }],
    }

    const view = render(signedIn(createElement(WishlistList, { products: [product] })))

    await screen.findByRole('heading', { name: '小樹 T 恤' })
    expect(view.container.querySelector('.wishlist-grid')).toHaveAttribute('data-columns', '1')
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
