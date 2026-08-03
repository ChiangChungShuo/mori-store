import { describe, expect, it } from 'vitest'
import { productFeatureLines } from '@/features/catalog/product-feature-lines'
import { productReviewSchema } from '@/features/reviews/product-review'

describe('product feature presentation', () => {
  it('turns newline content into clean feature rows without duplicate markers', () => {
    expect(productFeatureLines('✿ 復古滿版小花\n• 寬鬆燈籠版型\n3. 鬆緊腰圍')).toEqual([
      '復古滿版小花',
      '寬鬆燈籠版型',
      '鬆緊腰圍',
    ])
  })
})

describe('product review validation', () => {
  const base = {
    productId: '00000000-0000-4000-8000-000000000001',
    slug: 'mori-flora-pants',
    rating: '5',
    body: '孩子穿起來很舒服',
  }

  it('accepts a valid one-to-five-star review', () => {
    expect(productReviewSchema.parse(base)).toMatchObject({ rating: 5, body: '孩子穿起來很舒服' })
  })

  it('rejects invalid ratings and overly short comments', () => {
    expect(productReviewSchema.safeParse({ ...base, rating: '0' }).success).toBe(false)
    expect(productReviewSchema.safeParse({ ...base, body: '好' }).success).toBe(false)
  })
})
