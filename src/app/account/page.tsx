import Link from 'next/link'
import { AccountOrderRow } from '@/features/account/account-order-row'
import { getAccountSummary } from '@/features/account/summary'
import { RecentlyViewed } from '@/features/catalog/recently-viewed'
import { MemberCreditCard } from '@/features/account/member-credit-card'
import { requireUser } from '@/lib/auth/require-user'
import { formatTwd } from '@/lib/money'

export default async function AccountPage() {
  const user = await requireUser()
  const account = await getAccountSummary(user)
  // The last order's products, so a repeat purchase starts from one tap.
  const reorderItems = [...new Set(account.orders.flatMap((order) => order.items.map((item) => item.productName)))].slice(0, 6)

  return (
    <main className="account-page">
      <header className="account-page-heading">
        <div><p className="eyebrow">member garden</p><h1>{account.displayName}，歡迎回來。</h1></div>
        <p>這裡收好你的訂單、紅利與會員成長紀錄。</p>
      </header>

      {/* The member centre used to be a dead end: everything here reported on
          past orders and nothing led back to the shop. */}
      <nav className="account-quick-links" aria-label="快速前往">
        <Link href="/products"><span aria-hidden="true">🛍</span><strong>繼續購物</strong><small>看看最新上架與現貨</small></Link>
        <Link href="/wishlist"><span aria-hidden="true">♡</span><strong>追蹤清單</strong><small>回頭買下收藏的款式</small></Link>
        <Link href="/account/orders"><span aria-hidden="true">▤</span><strong>我的訂單</strong><small>查看付款與取貨進度</small></Link>
        <Link href="/faq"><span aria-hidden="true">?</span><strong>常見問題</strong><small>出貨、尺寸與退換說明</small></Link>
      </nav>

      <MemberCreditCard />

      {reorderItems.length > 0 ? (
        <section className="account-section account-reorder">
          <header><div><p className="eyebrow">buy it again</p><h2>再買一次</h2></div><Link href="/account/orders">看更多訂單 →</Link></header>
          <p className="account-reorder-note">孩子長得快，上次買的款式常常只是需要大一號。</p>
          <div className="account-reorder-items">
            {reorderItems.map((name) => (
              <Link href={`/products?q=${encodeURIComponent(name)}`} key={name}>{name}<span aria-hidden="true">→</span></Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="member-pass" aria-label="mori 會員資料">
        <div className="member-pass-identity"><p>mori family pass</p><strong>{account.displayName}</strong><span>{account.memberNumber}</span></div>
        <dl>
          <div><dt>會員等級</dt><dd>{account.tierLabel}</dd></div>
          <div><dt>紅利點數（累積中）</dt><dd>{account.points} PT</dd></div>
          <div><dt>專屬折扣</dt><dd>{account.discountPercent ? `${account.discountPercent}% OFF` : '累積中'}</dd></div>
        </dl>
        <div className="member-pass-ring" aria-label={`會員進度 ${account.progress}%`} style={{ '--member-progress': `${account.progress * 3.6}deg` } as React.CSSProperties}><span>{account.progress}%</span></div>
      </section>

      <section className="account-progress-panel">
        <header><div><p className="eyebrow">membership journey</p><h2>會員成長</h2></div><strong>{formatTwd(account.totalSpent)}</strong></header>
        <div className="account-progress-track"><i style={{ width: `${account.progress}%` }} /></div>
        <p>{account.nextTierLabel ? `再消費 ${formatTwd(account.amountToNextTier)} 即可成為${account.nextTierLabel}。` : '已達成最高會員等級，謝謝你和 mori 一起長大。'}</p>
        <div className="account-stats"><div><span>累計訂單</span><strong>{account.orderCount}</strong></div><div><span>累計消費</span><strong>{formatTwd(account.totalSpent)}</strong></div><div><span>點數回饋</span><strong>1%</strong></div></div>
      </section>

      <section className="account-section account-recent-orders">
        <header><div><p className="eyebrow">recent orders</p><h2>最近訂單</h2></div><Link href="/account/orders">查看全部 →</Link></header>
        {account.orders.length === 0 ? <div className="account-empty"><span aria-hidden="true">衣</span><h3>還沒有訂單</h3><p>從一件舒服的衣服開始，為孩子收藏每個成長日常。</p><Link className="button" href="/products">開始選購</Link></div> : account.orders.slice(0, 3).map((order) => <AccountOrderRow key={order.orderNumber} order={order} />)}
      </section>

      <section className="account-section" id="benefits">
        <header><div><p className="eyebrow">member benefits</p><h2>你的會員福利</h2></div></header>
        <div className="benefit-grid"><article><span>01</span><strong>消費累積紅利</strong><p>每筆有效訂單都會累積點數；目前為累積階段，開放折抵的時間會另行公告。</p></article><article><span>02</span><strong>會員限定優惠</strong><p>依會員等級享有專屬折扣與生日禮遇。</p></article><article><span>03</span><strong>訂單進度追蹤</strong><p>從付款、備貨到到店，隨時查看預計取貨時間。</p></article></div>
      </section>

      <section className="account-section account-profile" id="profile">
        <header><div><p className="eyebrow">profile</p><h2>基本資料</h2></div></header>
        <dl><div><dt>會員姓名</dt><dd>{account.displayName}</dd></div><div><dt>Email</dt><dd>{account.email}</dd></div><div><dt>手機號碼</dt><dd>{account.phone ?? '尚未提供'}</dd></div><div><dt>預設收件資料</dt><dd>{account.orders[0] ? `${account.orders[0].recipientName} · ${account.orders[0].recipientPhone}` : '完成第一筆訂單後自動帶入'}</dd></div></dl>
      </section>

      <RecentlyViewed title="你最近看過" />
    </main>
  )
}
