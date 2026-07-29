'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useCart } from '@/features/cart/cart-provider'
import { getCartQuantityLimit, isCartItem } from '@/features/cart/types'
import { calculateCart } from '@/features/cart/totals'
import type { StorefrontSettings } from '@/features/checkout/settings'
import { formatTwd } from '@/lib/money'
import { CheckoutProgress } from '@/features/checkout/checkout-progress'
import type { CouponValidation } from '@/features/checkout/coupons'
import type { CatalogProduct } from '@/features/catalog/queries'
import { ProductCard } from '@/features/catalog/product-card'

const couponStorageKey = 'mori-checkout-coupon'

export function CartPageClient({ settings, isSignedIn = false, recommendedProducts, couponAction }: {
  settings: StorefrontSettings
  isSignedIn?: boolean
  recommendedProducts?: CatalogProduct[]
  couponAction?: (code: string, subtotal: number) => Promise<CouponValidation>
}) {
  const { items, hydrated, dispatch, replaceItems } = useCart()
  const [refreshStatus, setRefreshStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [refreshAttempt, setRefreshAttempt] = useState(0)
  const [couponInput, setCouponInput] = useState('')
  const [appliedCouponCode, setAppliedCouponCode] = useState('')
  const [couponRequestId, setCouponRequestId] = useState(0)
  const [couponResult, setCouponResult] = useState<(CouponValidation & { subtotal: number }) | null>(null)
  const [couponPending, startCouponTransition] = useTransition()
  const refreshKey = JSON.stringify(
    items.map(({ variantId, quantity }) => ({ variantId, quantity })),
  )
  const totals = calculateCart(items, settings.shippingFee, settings.freeShippingThreshold)
  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const freeShippingRemaining = settings.freeShippingThreshold === null
    ? null
    : Math.max(0, settings.freeShippingThreshold - totals.subtotal)
  const freeShippingProgress = settings.freeShippingThreshold && settings.freeShippingThreshold > 0
    ? Math.min(100, Math.round((totals.subtotal / settings.freeShippingThreshold) * 100))
    : 100
  const appliedCoupon = couponResult?.ok && couponResult.subtotal === totals.subtotal
    ? couponResult
    : null
  const payableTotal = Math.max(0, totals.total - (appliedCoupon?.discount ?? 0))
  const cartProductSlugs = useMemo(() => new Set(items.map((item) => item.productSlug)), [items])
  const suggestions = (recommendedProducts ?? [])
    .filter((product) => !cartProductSlugs.has(product.slug))
    .slice(0, 4)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      const storedCode = window.sessionStorage.getItem(couponStorageKey) ?? ''
      setCouponInput(storedCode)
      setAppliedCouponCode(storedCode)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!hydrated || !appliedCouponCode || totals.subtotal <= 0 || !couponAction) return
    let cancelled = false
    startCouponTransition(async () => {
      const result = await couponAction(appliedCouponCode, totals.subtotal)
      if (cancelled) return
      setCouponResult({ ...result, subtotal: totals.subtotal })
      if (!result.ok) window.sessionStorage.removeItem(couponStorageKey)
    })
    return () => { cancelled = true }
  }, [appliedCouponCode, couponAction, couponRequestId, hydrated, totals.subtotal])

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
        const payload = await response.json() as unknown
        if (!response.ok
          || !payload
          || typeof payload !== 'object'
          || !Array.isArray((payload as { items?: unknown }).items)
          || !(payload as { items: unknown[] }).items.every(isCartItem)) {
          throw new Error('Cart refresh failed')
        }

        if (!cancelled) {
          replaceItems((payload as { items: import('@/features/cart/types').CartItem[] }).items)
          setRefreshStatus('success')
        }
      } catch {
        if (!cancelled) setRefreshStatus('error')
      }
    }

    void refreshCart()
    return () => { cancelled = true }
  }, [hydrated, refreshAttempt, refreshKey, replaceItems])

  return (
    <main className="section cart-page">
      <header className="page-heading">
        <p className="eyebrow">your cart</p>
        <h1>購物車</h1>
        <p>確認尺寸與數量，再選擇最方便的超商取貨門市。</p>
      </header>
      <CheckoutProgress current={1} />

      {!hydrated || (items.length > 0 && refreshStatus === 'loading') ? (
        <p aria-live="polite">正在確認最新商品與庫存…</p>
      ) : items.length === 0 ? (
        <div className="catalog-empty">
          <p>購物車目前是空的。</p>
          <Link href="/products" className="button">逛逛商品</Link>
        </div>
      ) : (
        <>
          {refreshStatus === 'error' ? (
            <div role="alert" className="cart-refresh-error">
              <p>無法更新購物車，請再試一次。</p>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setRefreshStatus('loading')
                  setRefreshAttempt((attempt) => attempt + 1)
                }}
              >
                重試
              </button>
            </div>
          ) : null}
          <div className="cart-layout">
            <section className="cart-products-card" aria-labelledby="cart-products-title">
              <header className="cart-card-heading">
                <h2 id="cart-products-title">購物車 <span>（{itemCount} 件）</span></h2>
                <button className="text-button" type="button" onClick={() => dispatch({ type: 'clear' })}>
                  清空購物車
                </button>
              </header>

              {freeShippingRemaining !== null ? (
                <div className="shipping-progress">
                  <p>
                    {freeShippingRemaining > 0
                      ? <>再買 <strong>{formatTwd(freeShippingRemaining)}</strong>，即可享有免運優惠</>
                      : <strong>已達免運門檻</strong>}
                  </p>
                  <div className="shipping-progress-track" aria-label={`免運進度 ${freeShippingProgress}%`}>
                    <span style={{ width: `${freeShippingProgress}%` }} />
                  </div>
                  <small>消費滿 {formatTwd(settings.freeShippingThreshold ?? 0)}，超商取貨免運</small>
                </div>
              ) : null}

              <div className="cart-table-heading" aria-hidden="true">
                <span>商品資料</span><span>商品單價</span><span>數量</span><span>商品小計</span>
              </div>
              <ul className="cart-page-list">
                {items.map((item) => (
                  <li key={item.variantId}>
                    <div className="cart-product-info">
                      <Link className="cart-product-image" href={`/products/${item.productSlug}`}>
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt={item.name} />
                        ) : <span aria-hidden="true">mori</span>}
                      </Link>
                      <div>
                        <h3><Link href={`/products/${item.productSlug}`}>{item.name}</Link></h3>
                        <p>{item.color}／尺寸 {item.size}</p>
                      </div>
                    </div>
                    <p className="cart-unit-price">{formatTwd(item.unitPrice)}</p>
                    <div className="quantity-stepper" role="group" aria-label={`${item.name} 數量調整`}>
                      <button
                        aria-label={`減少 ${item.name} 數量`}
                        disabled={item.quantity <= 1}
                        type="button"
                        onClick={() => dispatch({
                          type: 'setQuantity',
                          variantId: item.variantId,
                          quantity: item.quantity - 1,
                        })}
                      >−</button>
                      <output aria-label={`${item.name} 數量`} aria-live="polite">{item.quantity}</output>
                      <button
                        aria-label={`增加 ${item.name} 數量`}
                        disabled={item.quantity >= getCartQuantityLimit(item.maxStock)}
                        type="button"
                        onClick={() => dispatch({
                          type: 'setQuantity',
                          variantId: item.variantId,
                          quantity: item.quantity + 1,
                        })}
                      >＋</button>
                    </div>
                    <p className="cart-line-total">{formatTwd(item.unitPrice * item.quantity)}</p>
                    <button
                      aria-label={`移除 ${item.name}`}
                      className="cart-remove-button"
                      type="button"
                      onClick={() => dispatch({ type: 'remove', variantId: item.variantId })}
                    >×</button>
                  </li>
                ))}
              </ul>
            </section>

            <div className="cart-sidebar">
              {!isSignedIn ? <section className="member-nudge" aria-label="會員登入提示">
                <span aria-hidden="true">♧</span>
                <p>已經是會員？登入後可以更方便查看與管理訂單。</p>
                <Link href="/login" className="button button-secondary">登入</Link>
              </section> : null}
              <aside className="cart-summary cart-order-summary" aria-label="訂單摘要">
                <h2>訂單資訊</h2>
                <div className="cart-coupon-panel">
                  <div className="cart-coupon-heading"><span aria-hidden="true">%</span><div><label htmlFor="cart-coupon">優惠碼</label><small>每張訂單限用一組優惠碼</small></div></div>
                  <div className="cart-coupon-form"><input id="cart-coupon" aria-label="優惠碼" autoComplete="off" placeholder="請輸入優惠碼" value={couponInput} onChange={(event) => setCouponInput(event.target.value.toUpperCase())} /><button type="button" disabled={couponPending || !couponInput.trim()} onClick={() => {
                    const code = couponInput.trim().toUpperCase()
                    setAppliedCouponCode(code)
                    setCouponRequestId((requestId) => requestId + 1)
                    window.sessionStorage.setItem(couponStorageKey, code)
                  }}>{couponPending ? '確認中…' : '套用'}</button></div>
                  {couponResult ? <p className={couponResult.ok ? 'coupon-success' : 'coupon-error'} role="status">{couponResult.message}</p> : null}
                </div>
                <p><span>商品小計</span><strong>{formatTwd(totals.subtotal)}</strong></p>
                <p><span>運費</span><strong>{totals.shipping === 0 ? '免運' : formatTwd(totals.shipping)}</strong></p>
                {appliedCoupon ? <p className="cart-discount"><span>優惠碼 {appliedCoupon.code}</span><strong>−{formatTwd(appliedCoupon.discount)}</strong></p> : null}
                <p className="cart-total"><span>合計</span><strong>{formatTwd(payableTotal)}</strong></p>
                <Link
                  href={isSignedIn ? '/checkout' : '/login?next=%2Fcheckout'}
                  className="button button-wide"
                >
                  {isSignedIn ? '前往結帳' : '登入後結帳'}
                </Link>
              </aside>
            </div>
          </div>
          {suggestions.length > 0 ? <section className="cart-recommendations" aria-labelledby="cart-recommendations-title">
            <header className="section-heading"><div><p className="eyebrow">you may also like</p><h2 id="cart-recommendations-title">您可能喜歡</h2></div><p>依照購物車中的日常選品，再挑幾件好搭、好活動的款式。</p></header>
            <div className="product-grid">{suggestions.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          </section> : null}
        </>
      )}
    </main>
  )
}
