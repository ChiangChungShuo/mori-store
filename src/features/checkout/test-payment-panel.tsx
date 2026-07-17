'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import type { PaymentResult, TestPaymentOutcome } from '@/features/checkout/types'

const reviewGuidance = '付款結果需人工確認，商品資料或庫存已變更。'

export function TestPayment({
  attemptId,
  requiresReview = false,
}: {
  attemptId: string
  requiresReview?: boolean
}) {
  const { dispatch } = useCart()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [reviewMessage, setReviewMessage] = useState(requiresReview ? reviewGuidance : '')

  async function submit(outcome: TestPaymentOutcome) {
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/test-payment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attemptId, outcome }),
      })
      const result = await response.json() as PaymentResult | { error: string }
      if ('outcome' in result && result.outcome === 'requires_review') {
        setReviewMessage(result.message)
        setPending(false)
        return
      }
      if (!response.ok || !('redirectUrl' in result)) {
        throw new Error('error' in result ? result.error : '付款結果處理失敗')
      }

      if (result.outcome === 'success') dispatch({ type: 'clear' })
      window.location.assign(result.redirectUrl)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '付款結果處理失敗')
      setPending(false)
    }
  }

  return (
    <div className="test-payment">
      <p>這是測試付款，不會產生真實扣款。</p>
      {error ? <p role="alert">{error}</p> : null}
      {reviewMessage ? (
        <div role="alert">
          <p>{reviewMessage}</p>
          <p>購物袋未清除；請先聯絡客服確認，再更新商品與庫存。</p>
          <Link href="/cart">更新購物袋</Link>
        </div>
      ) : null}
      <div className="payment-actions">
        <button className="button" type="button" disabled={pending || Boolean(reviewMessage)} onClick={() => void submit('success')}>
          模擬付款成功
        </button>
        <button type="button" disabled={pending || Boolean(reviewMessage)} onClick={() => void submit('failure')}>
          模擬付款失敗
        </button>
        <button type="button" disabled={pending || Boolean(reviewMessage)} onClick={() => void submit('cancelled')}>
          模擬取消付款
        </button>
      </div>
    </div>
  )
}
