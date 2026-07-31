'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useCart } from '@/features/cart/cart-provider'
import { isCartItem } from '@/features/cart/types'
import { StorePicker, type StoreChain } from '@/features/checkout/store-picker'
import type { CheckoutActionState } from '@/features/checkout/types'
import type { PickedStore } from '@/lib/checkout/cvs-map'
import { formatTwd } from '@/lib/money'
import { trackStorefrontEvent } from '@/features/analytics/tracker'
import type { CouponValidation } from '@/features/checkout/coupons'

const couponStorageKey = 'mori-checkout-coupon'
const checkoutDraftStorageKey = 'mori-checkout-draft'

type CheckoutFormProps = {
  action: (
    previousState: CheckoutActionState,
    formData: FormData,
  ) => CheckoutActionState | Promise<CheckoutActionState>
  couponAction?: (code: string, subtotal: number) => Promise<CouponValidation>
  pickedStore?: PickedStore | null
  initialValues?: CheckoutInitialValues
}

export type CheckoutInitialValues = {
  email: string
  recipientName: string
  phone: string
  chain: StoreChain
  storeName: string
  storeId: string
}

const initialState: CheckoutActionState = { status: 'idle' }

type CheckoutField = 'email' | 'recipientName' | 'phone' | 'chain' | 'storeName' | 'storeId'

const errorIds: Record<CheckoutField, string> = {
  email: 'checkout-email-error',
  recipientName: 'checkout-recipient-name-error',
  phone: 'checkout-phone-error',
  chain: 'checkout-chain-error',
  storeName: 'checkout-store-name-error',
  storeId: 'checkout-store-error',
}

export function CheckoutForm({ action, couponAction, pickedStore, initialValues }: CheckoutFormProps) {
  const { items, hydrated, replaceItems } = useCart()
  const [state, formAction, pending] = useActionState(action, initialState)
  const chain: StoreChain = 'seven_eleven'
  const [storeName, setStoreName] = useState(pickedStore?.chain === 'seven_eleven'
    ? pickedStore.storeName
    : initialValues?.chain === 'seven_eleven' ? initialValues.storeName : '')
  const [storeId, setStoreId] = useState(pickedStore?.chain === 'seven_eleven'
    ? pickedStore.storeId
    : initialValues?.chain === 'seven_eleven' ? initialValues.storeId : '')
  const [storeAddress, setStoreAddress] = useState(pickedStore?.address ?? '')
  const [errors, setErrors] = useState<Partial<Record<CheckoutField, string>>>({})
  const [refreshAttempt, setRefreshAttempt] = useState(0)
  const [refreshedKey, setRefreshedKey] = useState('')
  const [refreshErrorKey, setRefreshErrorKey] = useState('')
  const [summary, setSummary] = useState<{ subtotal: number; shipping: number; total: number } | null>(null)
  const [contact, setContact] = useState({
    email: initialValues?.email ?? '',
    recipientName: initialValues?.recipientName ?? '',
    phone: initialValues?.phone ?? '',
  })
  const [customerNote, setCustomerNote] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [couponInput, setCouponInput] = useState('')
  const [couponResult, setCouponResult] = useState<(CouponValidation & { subtotal: number }) | null>(null)
  const [couponPending, startCouponTransition] = useTransition()
  const checkoutTracked = useRef(false)
  const draftLoaded = useRef(false)
  const refreshKey = JSON.stringify(items.map(({ variantId, quantity }) => ({ variantId, quantity })))
  const effectiveRefreshStatus = !hydrated || (refreshKey !== '[]'
    && refreshedKey !== refreshKey
    && refreshErrorKey !== refreshKey)
    ? 'loading'
    : refreshErrorKey === refreshKey
      ? 'error'
      : 'success'
  const cart = items.map(({ variantId, quantity }) => ({ variantId, quantity }))
  const contactComplete = /^\S+@\S+\.\S+$/.test(contact.email.trim())
    && contact.recipientName.trim().length > 0
    && /^09\d{8}$/.test(contact.phone.trim())
  const checkoutComplete = contactComplete && storeName.trim().length > 0 && storeId.trim().length > 0
  const appliedCoupon = couponResult?.ok && couponResult.subtotal === summary?.subtotal
    ? couponResult
    : null
  const payableTotal = Math.max(0, (summary?.total ?? 0) - (appliedCoupon?.discount ?? 0))

  useEffect(() => {
    if (hydrated && items.length > 0 && !checkoutTracked.current) {
      checkoutTracked.current = true
      trackStorefrontEvent('checkout_started')
    }
  }, [hydrated, items.length])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      const storedCoupon = window.sessionStorage.getItem(couponStorageKey) ?? ''
      setCouponCode(storedCoupon)
      setCouponInput(storedCoupon)
      try {
        const draft = JSON.parse(window.sessionStorage.getItem(checkoutDraftStorageKey) ?? '{}') as {
          email?: unknown
          recipientName?: unknown
          phone?: unknown
          chain?: unknown
          storeName?: unknown
          storeId?: unknown
          customerNote?: unknown
        }
        setContact({
          email: typeof draft.email === 'string' ? draft.email : initialValues?.email ?? '',
          recipientName: typeof draft.recipientName === 'string' ? draft.recipientName : initialValues?.recipientName ?? '',
          phone: typeof draft.phone === 'string' ? draft.phone : initialValues?.phone ?? '',
        })
        if (!pickedStore) {
          const canReuseDraftStore = draft.chain === 'seven_eleven'
          setStoreName(canReuseDraftStore && typeof draft.storeName === 'string'
            ? draft.storeName.slice(0, 60)
            : initialValues?.chain === 'seven_eleven' ? initialValues.storeName : '')
          setStoreId(canReuseDraftStore && typeof draft.storeId === 'string'
            ? draft.storeId.slice(0, 20)
            : initialValues?.chain === 'seven_eleven' ? initialValues.storeId : '')
        }
        setCustomerNote(typeof draft.customerNote === 'string' ? draft.customerNote.slice(0, 500) : '')
      } catch {
        window.sessionStorage.removeItem(checkoutDraftStorageKey)
      }
      draftLoaded.current = true
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time mount hydration; pickedStore is a stable server-provided prop
  }, [])

  useEffect(() => {
    if (!draftLoaded.current) return
    window.sessionStorage.setItem(checkoutDraftStorageKey, JSON.stringify({
      ...contact,
      chain,
      storeName,
      storeId,
      customerNote,
    }))
  }, [chain, contact, customerNote, storeName, storeId])

  useEffect(() => {
    if (!couponAction || !couponCode || !summary) return
    let cancelled = false
    startCouponTransition(async () => {
      const result = await couponAction(couponCode, summary.subtotal)
      if (cancelled) return
      setCouponResult({ ...result, subtotal: summary.subtotal })
      if (!result.ok) window.sessionStorage.removeItem(couponStorageKey)
    })
    return () => { cancelled = true }
  }, [couponAction, couponCode, summary])

  useEffect(() => {
    if (!hydrated || refreshKey === '[]') return

    let cancelled = false
    async function refreshCart() {
      try {
        const response = await fetch('/api/cart/refresh', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: `{"items":${refreshKey}}`,
        })
        const payload = await response.json() as {
          items?: unknown
          summary?: { subtotal?: unknown; shipping?: unknown; total?: unknown }
        }
        const nextSummary = payload.summary
        if (!response.ok
          || !Array.isArray(payload.items)
          || !payload.items.every(isCartItem)
          || !nextSummary
          || !Number.isInteger(nextSummary.subtotal)
          || !Number.isInteger(nextSummary.shipping)
          || !Number.isInteger(nextSummary.total)) {
          throw new Error('checkout refresh failed')
        }
        if (!cancelled) {
          replaceItems(payload.items)
          setSummary(nextSummary as { subtotal: number; shipping: number; total: number })
          setRefreshedKey(refreshKey)
          setRefreshErrorKey('')
        }
      } catch {
        if (!cancelled) setRefreshErrorKey(refreshKey)
      }
    }

    void refreshCart()
    return () => { cancelled = true }
  }, [hydrated, refreshAttempt, refreshKey, replaceItems])

  function retryRefresh() {
    setRefreshErrorKey('')
    setRefreshAttempt((attempt) => attempt + 1)
  }

  return (
    <form
      action={formAction}
      className="checkout-form"
      onInput={(event) => {
        const target = event.target
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return
        if (!target.validity.valid || !target.name) return
        setErrors((current) => ({ ...current, [target.name]: undefined }))
      }}
      onInvalid={(event) => {
        const target = event.target
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return
        if (!(target.name in errorIds)) return
        setErrors((current) => ({
          ...current,
          [target.name]: target.validationMessage || '請檢查此欄位。',
        }))
      }}
    >
      <div className="checkout-layout">
        <div className="checkout-details">
          <section className="checkout-card checkout-contact-card">
            <header><span>01</span><div><h2>收件人資料</h2><p>到貨通知會寄到這組 Email 與手機。</p></div></header>
            <div className="checkout-contact-fields">
              <label>Email<input aria-label="Email" aria-describedby={errors.email ? errorIds.email : undefined} aria-invalid={Boolean(errors.email)} name="email" type="email" autoComplete="email" placeholder="parent@example.com" required value={contact.email} onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))} />{errors.email ? <span id={errorIds.email} role="alert">{errors.email}</span> : null}</label>
              <label>收件人姓名<input aria-label="收件人姓名" aria-describedby={errors.recipientName ? errorIds.recipientName : undefined} aria-invalid={Boolean(errors.recipientName)} name="recipientName" autoComplete="name" placeholder="請填寫取貨證件上的姓名" required value={contact.recipientName} onChange={(event) => setContact((current) => ({ ...current, recipientName: event.target.value }))} />{errors.recipientName ? <span id={errorIds.recipientName} role="alert">{errors.recipientName}</span> : null}</label>
              <label>手機號碼<input aria-label="手機號碼" aria-describedby={errors.phone ? errorIds.phone : undefined} aria-invalid={Boolean(errors.phone)} name="phone" type="tel" inputMode="numeric" pattern="09[0-9]{8}" autoComplete="tel" placeholder="0912345678" required value={contact.phone} onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))} />{errors.phone ? <span id={errorIds.phone} role="alert">{errors.phone}</span> : null}</label>
            </div>
          </section>
          <section className="checkout-card checkout-store-card">
            <header><span>02</span><div><h2>選擇取貨門市</h2><p>目前僅支援 7-ELEVEN 超商取貨。</p></div></header>
            <StorePicker chain={chain} storeName={storeName} storeId={storeId} storeAddress={storeAddress} errors={{ chain: errors.chain, storeName: errors.storeName, storeId: errors.storeId }} onChainChange={() => undefined} onStoreNameChange={(value) => { setStoreName(value); setStoreAddress('') }} onStoreIdChange={(value) => { setStoreId(value); setStoreAddress('') }} />
          </section>
          <section className="checkout-card checkout-payment-card">
            <header><span>03</span><div><h2>付款方式</h2><p>下單後以銀行匯款完成付款。</p></div></header>
            <div className="checkout-payment-options">
              <label className="checkout-payment-option"><input type="radio" name="paymentMethod" value="bank_transfer" defaultChecked /><span><strong>銀行匯款</strong><small>訂單送出後顯示匯款帳號；完成後請到訂單填寫帳號末 5 碼。</small></span></label>
            </div>
          </section>
          <section className="checkout-card checkout-note-card">
            <header><span>04</span><div><h2>訂單留言</h2><p>有尺寸或包裝需求，可以在這裡告訴店家。</p></div></header>
            <label className="checkout-customer-note"><span>留言內容（選填）</span><textarea aria-label="訂單留言（選填）" name="customerNote" maxLength={500} rows={5} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="例如：請協助確認尺寸，或希望包裝完整後再出貨。" /><small><span>店家會在出貨前查看</span><span>{customerNote.length} / 500</span></small></label>
          </section>
          <section className="checkout-pickup-note"><strong>取貨提醒</strong><p>門市到貨後會發送通知，請於通知期限內攜帶與收件人相符的證件取貨。</p></section>
        </div>

        <aside className="checkout-sidebar-summary">
          {state.status === 'error' ? <div className="checkout-error" role="alert"><p>{state.message}</p>{state.refreshCart ? <button className="button button-secondary" type="button" onClick={retryRefresh}>更新購物車</button> : null}</div> : null}
          {effectiveRefreshStatus === 'loading' ? <p aria-live="polite">正在確認最新商品與庫存…</p> : null}
          {effectiveRefreshStatus === 'error' ? <div className="checkout-error" role="alert"><p>無法更新購物車，請再試一次。</p><button className="button button-secondary" type="button" onClick={retryRefresh}>重試</button></div> : null}
          {effectiveRefreshStatus === 'success' && summary && cart.length > 0 ? <div className="checkout-order-summary" aria-label="訂單摘要">
            <div className="checkout-summary-heading"><div><p>order summary</p><h2>訂單摘要</h2></div><Link href="/cart">返回修改購物車</Link></div>
            <ul>{items.map((item) => <li key={item.variantId}><div className="checkout-summary-image">{item.imageUrl ? <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src={item.imageUrl} />
            </> : <span>mori</span>}<b>{item.quantity}</b></div><div><strong>{item.name}</strong><small>{item.color}／尺寸 {item.size}</small></div><em>{formatTwd(item.unitPrice * item.quantity)}</em></li>)}</ul>
            {couponAction ? <div className="cart-coupon-panel checkout-coupon-panel">
              <div className="cart-coupon-heading"><span aria-hidden="true">%</span><div><label htmlFor="checkout-coupon">優惠碼</label><small>每張訂單限用一組優惠碼</small></div></div>
              <div className="cart-coupon-form"><input id="checkout-coupon" aria-label="優惠碼" autoComplete="off" placeholder="請輸入優惠碼" value={couponInput} onChange={(event) => setCouponInput(event.target.value.toUpperCase())} /><button type="button" disabled={couponPending || !couponInput.trim()} onClick={() => {
                const code = couponInput.trim().toUpperCase()
                setCouponCode(code)
                window.sessionStorage.setItem(couponStorageKey, code)
              }}>{couponPending ? '確認中…' : '套用'}</button></div>
              {couponResult ? <p className={couponResult.ok ? 'coupon-success' : 'coupon-error'} role="status">{couponResult.message}</p> : null}
            </div> : null}
            <dl><div><dt>商品小計</dt><dd>{formatTwd(summary.subtotal)}</dd></div><div><dt>超商運費</dt><dd>{summary.shipping === 0 ? '免運' : formatTwd(summary.shipping)}</dd></div>{appliedCoupon ? <div className="checkout-discount"><dt>優惠碼 {appliedCoupon.code}</dt><dd>−{formatTwd(appliedCoupon.discount)}</dd></div> : null}<div className="checkout-grand-total"><dt>應付合計</dt><dd>{formatTwd(payableTotal)}</dd></div></dl>
            {couponPending ? <p className="checkout-coupon-status" aria-live="polite">正在確認購物車優惠碼…</p> : null}
          </div> : null}
          <div className="checkout-payment-note"><strong>下一步：確認並送出訂單</strong><p>下一頁會顯示完整商品、客戶、付款與送貨資料；確認送出後才會成立訂單並保留庫存。</p></div>
          {!checkoutComplete && hydrated && cart.length > 0 ? <p className="checkout-incomplete" aria-live="polite">請填妥顧客資料並選擇取貨門市，即可確認訂單。</p> : null}
          <button className="button checkout-submit" type="submit" disabled={pending || !hydrated || effectiveRefreshStatus !== 'success' || cart.length === 0 || !checkoutComplete || couponPending}>{pending ? '送出資料中…' : checkoutComplete ? '送出資料，確認訂單' : '請先完成訂單資料'}</button>
          <div className="checkout-assurances"><span>SSL 安全連線</span><span>超商取貨通知</span><span>會員可追蹤訂單</span></div>
          {hydrated && cart.length === 0 ? <p role="alert">購物車沒有可結帳的商品。</p> : null}
        </aside>
      </div>
      <input type="hidden" name="cart" value={JSON.stringify(cart)} />
      <input type="hidden" name="couponCode" value={appliedCoupon?.code ?? ''} />
    </form>
  )
}
