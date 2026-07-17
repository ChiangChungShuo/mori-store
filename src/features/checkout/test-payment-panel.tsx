'use client'

import { useState } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import type { PaymentResult, TestPaymentOutcome } from '@/features/checkout/types'

export function TestPayment({ attemptId }: { attemptId: string }) {
  const { dispatch } = useCart()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

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
      <div className="payment-actions">
        <button className="button" type="button" disabled={pending} onClick={() => void submit('success')}>
          模擬付款成功
        </button>
        <button type="button" disabled={pending} onClick={() => void submit('failure')}>
          模擬付款失敗
        </button>
        <button type="button" disabled={pending} onClick={() => void submit('cancelled')}>
          模擬取消付款
        </button>
      </div>
    </div>
  )
}
