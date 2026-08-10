import { notFound } from 'next/navigation'
import { getAuthorizedCompletedOrder } from '@/features/checkout/service'
import { PurchaseTracker } from '@/features/analytics/storefront-tracker'
import Link from 'next/link'
import { getBankTransferInfo } from '@/features/checkout/bank-transfer'
import { formatTwd } from '@/lib/money'
import { BankTransferForm } from '@/features/orders/bank-transfer-form'
import { submitGuestBankTransferLastFive } from '@/features/orders/bank-transfer-actions'
import { getCurrentUser } from '@/lib/auth/require-user'
import { getActiveWelcomeGift } from '@/features/marketing/welcome-gift'

type OrderCompletePageProps = {
  params: Promise<{ orderNumber: string }>
  searchParams: Promise<{ attemptId?: string }>
}

export default async function OrderCompletePage({ params, searchParams }: OrderCompletePageProps) {
  const { orderNumber } = await params
  const { attemptId } = await searchParams
  if (!attemptId) notFound()

  let order
  try {
    order = await getAuthorizedCompletedOrder(attemptId, orderNumber)
  } catch {
    notFound()
  }
  if (!order) notFound()
  const bank = order.paymentMethod === 'bank_transfer' ? getBankTransferInfo() : null
  // Nobody has to register to buy. The invitation to become a member comes
  // after the money is in, where it costs the shopper nothing to say yes.
  const [viewer, welcomeGift] = await Promise.all([getCurrentUser(), getActiveWelcomeGift()])

  return (
    <main className="section order-complete-page">
      <PurchaseTracker />
      <section className="order-complete-hero">
        <span className="order-complete-mark" aria-hidden="true">✓</span>
        <p>thank you for your order</p>
        <h1>訂單完成</h1>
        <p>{order.paymentMethod === 'bank_transfer' ? '訂單已成立，請依下方資訊完成匯款。' : '訂單已成立，商品抵達門市後再完成取貨付款。'}</p>
        <div><span>訂單編號</span><strong>{order.orderNumber}</strong></div>
      </section>
      <div className="order-complete-layout">
        <section className="order-complete-next">
          <header><p>what happens next</p><h2>接下來的配送進度</h2></header>
          <ol>
            <li data-state="complete"><span>01</span><div><strong>訂單成立</strong><p>商品庫存已為這筆訂單保留。</p></div></li>
            <li data-state="current"><span>02</span><div><strong>{order.paymentMethod === 'bank_transfer' ? '等待匯款核對' : '商品備貨'}</strong><p>{order.paymentMethod === 'bank_transfer' ? '匯款後請在下方填寫帳號末 5 碼。' : '店家會確認商品與包裝，準備交寄至超商。'}</p></div></li>
            <li><span>03</span><div><strong>門市取貨</strong><p>商品抵達後會發送通知，請在期限內完成取貨。</p></div></li>
          </ol>
        </section>
        <aside className="order-complete-summary">
          <p>order summary</p>
          <h2>訂單資訊</h2>
          <dl>
            <div><dt>付款方式</dt><dd>{order.paymentMethod === 'bank_transfer' ? '銀行匯款' : '超商取貨付款'}</dd></div>
            <div><dt>應付金額</dt><dd>{formatTwd(order.total ?? 0)}</dd></div>
            <div><dt>取貨通路</dt><dd>{order.storeChain === 'family_mart' ? '全家' : '7-ELEVEN'}</dd></div>
            <div><dt>取貨門市</dt><dd>{order.storeName}<small>店號 {order.storeId}</small></dd></div>
            <div><dt>目前狀態</dt><dd>{order.paymentMethod === 'bank_transfer' ? '等待匯款' : '等待備貨'}</dd></div>
          </dl>
        </aside>
      </div>
      {bank ? <section className="bank-transfer-instructions" aria-labelledby="bank-transfer-title">
        <header><p>bank transfer</p><h2 id="bank-transfer-title">匯款資訊</h2><span>請匯入下列帳號，並保留匯款明細。</span></header>
        <dl>
          <div><dt>銀行</dt><dd>{bank.bankName}（{bank.bankCode}）</dd></div>
          <div><dt>帳號</dt><dd>{bank.accountNumber}</dd></div>
          <div><dt>戶名</dt><dd>{bank.accountName}</dd></div>
          <div><dt>匯款金額</dt><dd>{formatTwd(order.total ?? 0)}</dd></div>
        </dl>
        {!bank.isConfigured ? <p className="bank-transfer-warning">目前為示範資料，正式上線前需由店家設定真實收款帳號。</p> : null}
        {order.status === 'pending_payment' ? (
          <BankTransferForm
            action={submitGuestBankTransferLastFive.bind(null, order.orderNumber, order.email)}
            initialValue=""
          />
        ) : null}
      </section> : null}
      {!viewer ? (
        <section className="guest-member-invite" aria-labelledby="guest-member-invite-title">
          <div>
            <p className="eyebrow">become a member</p>
            <h2 id="guest-member-invite-title">用同一個 Email 建立會員</h2>
            <p>
              這筆訂單已經成立，不需要註冊也能查詢。若用 <strong>{order.email}</strong> 建立會員，
              下次結帳資料會自動帶入，訂單進度也能直接在會員中心看到
              {welcomeGift ? `，還會拿到 ${formatTwd(welcomeGift.amount)} 購物金（下次結帳自動折抵）` : ''}。
            </p>
          </div>
          <Link className="button" href={`/signup?next=${encodeURIComponent('/account/orders')}`}>建立會員</Link>
        </section>
      ) : null}
      <nav className="order-complete-actions" aria-label="訂單完成後續操作">
        {viewer
          ? <Link className="button" href="/account/orders">前往我的訂單</Link>
          : <Link className="button" href="/order-lookup">查詢訂單進度</Link>}
        <Link className="button button-secondary" href="/products">繼續選購</Link>
      </nav>
    </main>
  )
}
