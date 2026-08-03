'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/require-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { isE2EMode } from '@/testing/e2e-mode'
import { hasPurchasedProduct } from '@/features/reviews/product-review-data'
import {
  productReviewSchema,
  type ProductReviewActionState,
} from '@/features/reviews/product-review'

export async function submitProductReview(
  _previousState: ProductReviewActionState,
  formData: FormData,
): Promise<ProductReviewActionState> {
  const user = await getCurrentUser()
  if (!user) return { status: 'error', message: '請先登入會員後再留下評論' }

  const parsed = productReviewSchema.safeParse({
    productId: formData.get('productId'),
    slug: formData.get('slug'),
    rating: formData.get('rating'),
    body: formData.get('body'),
  })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message }

  const eligible = await hasPurchasedProduct(user.id, parsed.data.productId)
  if (!eligible) return { status: 'error', message: '購買並完成付款後，才能評論這件商品' }

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const store = getE2EStore()
    const existing = store.productReviews.find((review) => (
      review.productId === parsed.data.productId && review.userId === user.id
    ))
    if (existing) {
      existing.rating = parsed.data.rating
      existing.body = parsed.data.body
      existing.updatedAt = new Date().toISOString()
    } else {
      const now = new Date().toISOString()
      store.productReviews.push({
        id: crypto.randomUUID(),
        productId: parsed.data.productId,
        userId: user.id,
        rating: parsed.data.rating,
        body: parsed.data.body,
        createdAt: now,
        updatedAt: now,
      })
    }
  } else {
    const { error } = await createAdminClient().from('product_reviews').upsert({
      product_id: parsed.data.productId,
      user_id: user.id,
      rating: parsed.data.rating,
      body: parsed.data.body,
    }, { onConflict: 'product_id,user_id' })
    if (error) return { status: 'error', message: '目前無法儲存評論，請稍後再試' }
  }

  revalidatePath(`/products/${parsed.data.slug}`)
  return { status: 'success', message: '評論已送出，謝謝你的分享！' }
}
