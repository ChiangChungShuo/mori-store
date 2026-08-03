import { z } from 'zod'

export const reviewableOrderStatuses = ['paid', 'preparing', 'shipped', 'collected'] as const

export const productReviewSchema = z.object({
  productId: z.string().uuid('商品資料不正確'),
  slug: z.string().trim().min(1, '商品資料不正確').max(160, '商品資料不正確'),
  rating: z.coerce.number().int().min(1, '請選擇評分').max(5, '評分不正確'),
  body: z.string().trim().min(2, '請至少輸入 2 個字').max(500, '評論最多 500 個字'),
})

export type ProductReview = {
  id: string
  rating: number
  body: string
  createdAt: string
  isOwn: boolean
}

export type ProductReviewData = {
  reviews: ProductReview[]
  averageRating: number | null
  isSignedIn: boolean
  canReview: boolean
  currentUserReview: ProductReview | null
}

export type ProductReviewActionState = {
  status: 'idle' | 'success' | 'error'
  message?: string
}
