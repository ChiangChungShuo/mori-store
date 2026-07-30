import { notFound } from 'next/navigation'
import { getAuthorizedPaymentAttempt } from '@/features/checkout/service'
import { OrderSubmitPanel } from '@/features/checkout/order-submit-panel'
import { formatTwd } from '@/lib/money'
import { CheckoutProgress } from '@/features/checkout/checkout-progress'

type TestPaymentPageProps = {
  params: Promise<{ attemptId: string }>
}

export default async function TestPaymentPage({ params }: TestPaymentPageProps) {
  const { attemptId } = await params
  const payment = await (async () => {
    try {
      return await getAuthorizedPaymentAttempt(attemptId)
    } catch {
      notFound()
    }
  })()
  const discount = Math.max(0, payment.subtotal + payment.shippingFee - payment.total)
  const storeChain = payment.storeChain === 'family_mart' ? '全家' : '7-ELEVEN'

  return (
    <main className="section payment-page">
      <header className="page-heading">
        <p>order confirmation</p>
        <h1>訂單確認</h1>
        <span>請再次確認商品、客戶與取貨資訊，資料正確後再完成付款。</span>
      </header>
      <CheckoutProgress current={3} />
      <div className="payment-layout">
        <section className="payment-products" aria-labelledby="payment-products-title">
          <header><div><p>order items</p><h2 id="payment-products-title">購買商品</h2></div><span>{payment.items.reduce((total, item) => total + item.quantity, 0)} 件</span></header>
          <ul>
            {payment.items.map((item) => (
              <li key={item.variantId}>
                <div className="payment-product-image">{item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={item.productName} src={item.imageUrl} />
                ) : <span>mori</span>}</div>
                <div className="payment-product-copy">
                  <h3>{item.productName}</h3>
                  <dl><div><dt>型號</dt><dd>{item.sku}</dd></div><div><dt>顏色</dt><dd>{item.color}</dd></div><div><dt>尺寸</dt><dd>{item.size}</dd></div></dl>
                </div>
                <div className="payment-product-price"><small>{formatTwd(item.unitPrice)} × {item.quantity}</small><strong>{formatTwd(item.unitPrice * item.quantity)}</strong></div>
              </li>
            ))}
          </ul>
          <div className="payment-confirmation-details">
            <header><div><p>confirmation details</p><h2>訂購資料</h2></div><p>請核對以下資料；需要調整時可返回上一頁修改。</p></header>
            <div className="payment-confirmation-grid">
              <section className="payment-info-card"><span aria-hidden="true">收</span><div><p>customer</p><h3>客戶資料</h3><dl><div><dt>收件人</dt><dd>{payment.recipientName}</dd></div><div><dt>手機</dt><dd>{payment.recipientPhone}</dd></div><div><dt>Email</dt><dd>{payment.email}</dd></div></dl></div></section>
              <section className="payment-info-card"><span aria-hidden="true">店</span><div><p>delivery</p><h3>送貨資訊</h3><dl><div><dt>取貨方式</dt><dd>{storeChain} 超商取貨</dd></div><div><dt>取貨門市</dt><dd>{payment.storeName ?? '已選擇門市'}（{payment.storeId ?? '—'}）</dd></div></dl></div></section>
            </div>
            <section className="payment-customer-note"><div><p>order note</p><h3>買家留言</h3></div><p>{payment.customerNote || '本筆訂單沒有留言'}</p></section>
          </div>
        </section>

        <aside className="payment-sidebar">
          <section className="payment-delivery-card">
            <header><p>pickup & payment</p><h2>取貨與付款</h2></header>
            <dl>
              <div><dt>取貨方式</dt><dd>{storeChain} 超商取貨</dd></div>
              <div><dt>取貨門市</dt><dd><strong>{payment.storeName ?? '已選擇門市'}</strong><span>店號 {payment.storeId ?? '—'}</span></dd></div>
              <div><dt>付款方式</dt><dd><strong>{payment.paymentMethod === 'bank_transfer' ? '銀行匯款' : '超商取貨付款'}</strong><span>{payment.paymentMethod === 'bank_transfer' ? '送出訂單後顯示匯款帳號' : '商品到店取貨時付款'}</span></dd></div>
            </dl>
          </section>
          <section className="payment-total-card" aria-label="付款訂單摘要">
            <h2>金額明細</h2>
            <dl><div><dt>商品小計</dt><dd>{formatTwd(payment.subtotal)}</dd></div><div><dt>超商運費</dt><dd>{payment.shippingFee === 0 ? '免運' : formatTwd(payment.shippingFee)}</dd></div>{discount > 0 ? <div className="payment-discount"><dt>優惠折抵</dt><dd>−{formatTwd(discount)}</dd></div> : null}<div className="payment-grand-total"><dt>應付合計</dt><dd>{formatTwd(payment.total)}</dd></div></dl>
          </section>
          <OrderSubmitPanel attemptId={attemptId} paymentMethod={payment.paymentMethod} items={payment.items.map((item) => ({ productName: item.productName, color: item.color, size: item.size, quantity: item.quantity }))} />
        </aside>
      </div>
    </main>
  )
}
