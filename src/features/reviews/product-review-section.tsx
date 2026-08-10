'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { submitProductReview } from '@/features/reviews/product-review-actions'
import type { ProductReviewData } from '@/features/reviews/product-review'

const initialState = { status: 'idle' as const }

function Stars({ rating }: { rating: number }) {
  return <span className="review-stars" aria-label={`${rating} 顆星`}>
    {[1, 2, 3, 4, 5].map((star) => <span key={star} data-active={star <= Math.round(rating)}>★</span>)}
  </span>
}

export function ProductReviewSection({
  productId,
  productSlug,
  data,
}: {
  productId: string
  productSlug: string
  data: ProductReviewData
}) {
  const [state, action, pending] = useActionState(submitProductReview, initialState)
  const [rating, setRating] = useState(data.currentUserReview?.rating ?? 5)

  // With no reviews yet, this block only told visitors that nobody had bought
  // the product. It stays hidden until there is something to read, unless the
  // viewer is the one person who can write the first one.
  if (data.reviews.length === 0 && !data.canReview) return null

  return <section className="section product-review-section" id="reviews">
    <header className="product-review-heading">
      <div><p className="eyebrow">verified voices</p><h2>商品評論</h2></div>
      {data.averageRating ? <div className="product-review-average">
        <strong>{data.averageRating.toFixed(1)}</strong>
        <span><Stars rating={data.averageRating} /><small>{data.reviews.length} 則已購買評論</small></span>
      </div> : <p>還沒有評論，成為第一個分享的人！</p>}
    </header>

    <div className="product-review-layout">
      <div className="product-review-list" aria-live="polite">
        {data.reviews.length ? data.reviews.map((review) => <article key={review.id} className="product-review-card">
          <header><div><strong>{review.isOwn ? '你的評論' : '已購買會員'}</strong><span className="verified-review-badge">已購買</span></div><time dateTime={review.createdAt}>{new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium' }).format(new Date(review.createdAt))}</time></header>
          <Stars rating={review.rating} />
          <p>{review.body}</p>
        </article>) : <div className="product-review-empty"><span aria-hidden="true">♡</span><strong>等待第一則穿著心得</strong><p>購買過這件商品的會員，可以分享尺寸與穿著感受。</p></div>}
      </div>

      <aside className="product-review-compose">
        {!data.isSignedIn ? <><p className="eyebrow">member review</p><h3>購買後分享心得</h3><p>登入會員後，購買過這件商品即可留下真實評論。</p><Link className="button" href={`/login?next=/products/${productSlug}%23reviews`}>登入會員</Link></> : !data.canReview ? <><p className="eyebrow">verified purchase</p><h3>已購買才能評論</h3><p>完成付款後即可分享評分、尺寸感受與孩子的穿著心得。</p></> : <form action={action}>
          <p className="eyebrow">your review</p><h3>{data.currentUserReview ? '更新你的評論' : '分享穿著心得'}</h3>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="slug" value={productSlug} />
          <input type="hidden" name="rating" value={rating} />
          <fieldset><legend>商品評分</legend><div className="review-rating-input" role="radiogroup" aria-label="商品評分">
            {[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" role="radio" aria-checked={rating === star} aria-label={`${star} 顆星`} data-active={star <= rating} onClick={() => setRating(star)}>★</button>)}
          </div></fieldset>
          <label>評論內容<textarea name="body" minLength={2} maxLength={500} required defaultValue={data.currentUserReview?.body ?? ''} placeholder="例如：孩子的身高、體重、選擇尺寸與實際穿著感受" /></label>
          {state.message ? <p className="product-review-message" data-status={state.status} role="status">{state.message}</p> : null}
          <button className="button" type="submit" disabled={pending}>{pending ? '送出中…' : data.currentUserReview ? '更新評論' : '送出評論'}</button>
        </form>}
      </aside>
    </div>
  </section>
}
