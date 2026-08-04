'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import { splitProductDisplayName } from '@/features/catalog/product-presentation'
import type { OrderSubmissionResult, PaymentMethod } from '@/features/checkout/types'

type ConfirmItem = { productName: string; color: string; size: string; quantity: number }

const paymentMethodLabels: Record<PaymentMethod, string> = {
  bank_transfer: '銀行匯款',
  convenience_cod: '超商取貨付款',
  online_test: '線上付款',
}

export function OrderSubmitPanel({
  attemptId,
  paymentMethod,
  items,
}: {
  attemptId: string
  paymentMethod: PaymentMethod
  items: ConfirmItem[]
}) {
  const { dispatch } = useCart()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

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
      setConfirmOpen(false)
    }
  }

  return (
    <div className="order-submit-panel">
      <p>{paymentMethod === 'bank_transfer'
        ? '送出後會顯示匯款帳號，訂單將保留庫存並等待你的末 5 碼。'
        : '送出後訂單即成立，商品到店時再向超商付款。'}</p>
      {error ? <div role="alert"><p>{error}</p><Link className="text-link" href="/cart">返回購物車確認庫存</Link></div> : null}
      <button className="button" type="button" disabled={pending} onClick={() => { setAcknowledged(false); setConfirmOpen(true) }}>
        確認資料並送出訂單
      </button>
      <Link className="button button-secondary" href="/checkout">返回修改資料</Link>

      {confirmOpen ? (
        <div className="confirm-modal-backdrop" role="presentation" onClick={() => !pending && setConfirmOpen(false)}>
          <div className="confirm-modal order-confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" onClick={(event) => event.stopPropagation()}>
            <header className="order-confirm-head">
              <h2 id="confirm-modal-title">送出前再看一眼</h2>
              <p>訂單成立後就無法修改付款方式與商品內容了。</p>
            </header>
            <p className="order-confirm-payment"><span>付款方式</span><strong>{paymentMethodLabels[paymentMethod]}</strong></p>
            <ul className="order-confirm-items">
              {items.map((item, index) => {
                const { series, title } = splitProductDisplayName(item.productName)
                return (
                  <li key={`${item.productName}-${index}`}>
                    <span className="order-confirm-item-name">
                      {series ? <small>{series}</small> : null}
                      <strong>{title}</strong>
                      <small>{item.color}／尺寸 {item.size}</small>
                    </span>
                    <span className="order-confirm-qty">×{item.quantity}</span>
                  </li>
                )
              })}
            </ul>
            <p className="order-confirm-note">訂單成立後恕無法合併訂單或修改購物金折抵金額。</p>
            <label className="order-confirm-ack" data-checked={acknowledged}>
              <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
              <span aria-hidden="true" className="order-confirm-tick" />
              我已確認付款方式與商品顏色、尺寸、數量無誤
            </label>
            <div className="confirm-modal-actions">
              <button className="button button-secondary" type="button" disabled={pending} onClick={() => setConfirmOpen(false)}>再檢查一下</button>
              <button className="button" type="button" disabled={pending || !acknowledged} onClick={() => void submit()}>{pending ? '正在送出訂單…' : '確認送出訂單'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
