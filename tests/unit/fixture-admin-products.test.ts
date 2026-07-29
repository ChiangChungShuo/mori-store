import { describe, expect, it } from 'vitest'
import { listFixtureAdminProducts } from '@/features/admin/product-actions'

describe('fixture inventory overview', () => {
  it('summarizes every local product and its variant stock', () => {
    const products = listFixtureAdminProducts()
    expect(products).toHaveLength(8)
    expect(products[0]).toEqual(expect.objectContaining({
      isPublished: true,
      totalStock: expect.any(Number),
      imageUrl: expect.stringMatching(/^\/images\/products\//),
    }))
    expect(products.every((product) => product.totalStock >= 0)).toBe(true)
  })
})
