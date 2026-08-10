import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listProductRatings } from '@/features/reviews/product-review-data'
import { ProductCard } from '@/features/catalog/product-card'
import { WishlistAuthProvider } from '@/features/wishlist/wishlist-auth'
import { createE2EStore, getE2EStore } from '@/testing/e2e-store'
import type { CatalogProduct } from '@/features/catalog/queries'

vi.stubEnv('MORI_E2E_FIXTURES', '1')

const product: CatalogProduct = {
  id: 'product-1',
  slug: 'mori-tree-tee',
  name: '有機棉小樹 T 恤',
  description: '柔軟透氣',
  category: '上衣',
  series: [],
  ageBands: ['3-6'],
  material: '有機棉',
  careInstructions: '冷水洗',
  sizeGuide: '正常版型',
  isNew: false,
  imageUrl: null,
  imageAlt: '有機棉小樹 T 恤',
  variants: [
    { id: '10000000-0000-4000-8000-000000000101', sku: 'TEE-100', color: '綠', size: '100', price: 680, compareAtPrice: null, stock: 3 },
  ],
}

function review(productId: string, rating: number) {
  return {
    id: crypto.randomUUID(),
    productId,
    userId: crypto.randomUUID(),
    rating,
    body: '很好穿',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

beforeEach(() => {
  Object.assign(getE2EStore(), createE2EStore())
})

afterEach(cleanup)

describe('listProductRatings', () => {
  it('averages each product in a single pass', async () => {
    getE2EStore().productReviews.push(review('product-1', 5), review('product-1', 4), review('product-2', 3))

    const ratings = await listProductRatings()

    expect(ratings.get('product-1')).toEqual({ average: 4.5, count: 2 })
    expect(ratings.get('product-2')).toEqual({ average: 3, count: 1 })
    expect(ratings.get('product-3')).toBeUndefined()
  })
})

describe('ProductCard rating', () => {
  it('shows the score and count once a product has reviews', () => {
    render(
      <WishlistAuthProvider isSignedIn={false}>
        {createElement(ProductCard, { product, rating: { average: 4.5, count: 2 } })}
      </WishlistAuthProvider>,
    )

    expect(screen.getByLabelText('平均 4.5 顆星，共 2 則評論')).toBeInTheDocument()
    expect(screen.getByText('4.5')).toBeInTheDocument()
  })

  it('stays quiet when nobody has reviewed yet', () => {
    render(
      <WishlistAuthProvider isSignedIn={false}>
        {createElement(ProductCard, { product })}
      </WishlistAuthProvider>,
    )

    expect(document.querySelector('.product-card-rating')).toBeNull()
  })
})
