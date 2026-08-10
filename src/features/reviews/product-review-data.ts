import 'server-only'

import { getCurrentUser } from '@/lib/auth/require-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { isE2EMode } from '@/testing/e2e-mode'
import {
  reviewableOrderStatuses,
  type ProductReview,
  type ProductReviewData,
} from '@/features/reviews/product-review'

function averageRating(reviews: ProductReview[]) {
  if (!reviews.length) return null
  return reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
}

export async function hasPurchasedProduct(userId: string, productId: string) {
  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const store = getE2EStore()
    const product = store.products.find((candidate) => candidate.id === productId)
    const variantIds = new Set(product?.variants.map((variant) => variant.id) ?? [])
    return [...store.orders.values()].some((order) => (
      order.userId === userId
      && reviewableOrderStatuses.includes(order.status as (typeof reviewableOrderStatuses)[number])
      && order.items.some((item) => variantIds.has(item.variantId))
    ))
  }

  const { data, error } = await createAdminClient()
    .from('orders')
    .select('id, order_items!inner(product_id)')
    .eq('user_id', userId)
    .in('status', [...reviewableOrderStatuses])
    .eq('order_items.product_id', productId)
    .limit(1)

  if (error) throw error
  return Boolean(data?.length)
}

export async function getProductReviewData(productId: string): Promise<ProductReviewData> {
  const user = await getCurrentUser()

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const rows = getE2EStore().productReviews
      .filter((review) => review.productId === productId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    const reviews = rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      body: row.body,
      createdAt: row.createdAt,
      isOwn: row.userId === user?.id,
    }))
    const currentUserReview = reviews.find((review) => review.isOwn) ?? null
    return {
      reviews,
      averageRating: averageRating(reviews),
      isSignedIn: Boolean(user),
      canReview: user ? await hasPurchasedProduct(user.id, productId) : false,
      currentUserReview,
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return { reviews: [], averageRating: null, isSignedIn: Boolean(user), canReview: false, currentUserReview: null }
  }

  try {
    const { data, error } = await createAdminClient()
      .from('product_reviews')
      .select('id, user_id, rating, body, created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
    if (error) throw error

    const reviews = (data ?? []).map((row) => ({
      id: row.id,
      rating: row.rating,
      body: row.body,
      createdAt: row.created_at,
      isOwn: row.user_id === user?.id,
    }))
    const currentUserReview = reviews.find((review) => review.isOwn) ?? null
    return {
      reviews,
      averageRating: averageRating(reviews),
      isSignedIn: Boolean(user),
      canReview: user ? await hasPurchasedProduct(user.id, productId) : false,
      currentUserReview,
    }
  } catch {
    // Reviews are supplementary content and must never take down a product page.
    return { reviews: [], averageRating: null, isSignedIn: Boolean(user), canReview: false, currentUserReview: null }
  }
}

/** Rating summary per product id, for listing cards. */
export type ProductRatingSummary = { average: number; count: number }

/**
 * One aggregate read for a whole listing page. Cards need only the average and
 * the count, so this deliberately avoids the per-product query above.
 */
export async function listProductRatings(): Promise<Map<string, ProductRatingSummary>> {
  const summaries = new Map<string, ProductRatingSummary>()

  function collect(rows: Array<{ productId: string; rating: number }>) {
    const totals = new Map<string, { sum: number; count: number }>()
    for (const row of rows) {
      const entry = totals.get(row.productId) ?? { sum: 0, count: 0 }
      entry.sum += row.rating
      entry.count += 1
      totals.set(row.productId, entry)
    }
    for (const [productId, entry] of totals) {
      summaries.set(productId, { average: entry.sum / entry.count, count: entry.count })
    }
    return summaries
  }

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    return collect(getE2EStore().productReviews.map((review) => ({
      productId: review.productId,
      rating: review.rating,
    })))
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return summaries

  try {
    const { data, error } = await createAdminClient()
      .from('product_reviews')
      .select('product_id, rating')
      .limit(5_000)
    if (error || !data) return summaries
    return collect(data.map((row) => ({ productId: String(row.product_id), rating: Number(row.rating) })))
  } catch {
    // A listing page must still render without ratings.
    return summaries
  }
}
