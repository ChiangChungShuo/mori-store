'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import type { OrderSubmissionResult, PaymentMethod } from '@/features/checkout/types'

export function OrderSubmitPanel({
  attemptId,
  paymentMethod,
}: {
  attemptId: string
  paymentMethod: PaymentMethod
}) {
  const { dispatch } = useCart()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/order-submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attemptId }),
      })
      const result = await response.json() as OrderSubmissionResult | { error: string }
      if (!response.ok || !('redirectUrl' in result)) {
        throw new Error('error' in result ? result.error : '訂單送出失敗')
      }
      dispatch({ type: 'clear' })
      window.sessionStorage.removeItem('mori-checkout-coupon')
      window.sessionStorage.removeItem('mori-checkout-draft')
      window.location.assign(result.redirectUrl)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '訂單送出失敗')
      setPending(false)
    }
  }

  return (
    <div className="order-submit-panel">
      <p>{paymentMethod === 'bank_transfer'
        ? '送出後會顯示匯款帳號，訂單將保留庫存並等待你的末 5 碼。'
        : '送出後訂單即成立，商品到店時再向超商付款。'}</p>
      {error ? <div role="alert"><p>{error}</p><Link className="text-link" href="/cart">返回購物車確認庫存</Link></div> : null}
      <button className="button" type="button" disabled={pending} onClick={() => void submit()}>
        {pending ? '正在送出訂單…' : '確認資料並送出訂單'}
      </button>
      <Link className="button button-secondary" href="/checkout">返回修改資料</Link>
    </div>
  )
}
