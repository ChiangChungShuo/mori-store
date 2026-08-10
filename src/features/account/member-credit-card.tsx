import { formatTwd } from '@/lib/money'
import { getMemberCredit } from '@/features/account/member-credit'

const reasonLabels: Record<string, string> = {
  signup_gift: '新會員註冊禮',
  order: '訂單折抵',
  manual: '店家調整',
}

/**
 * 購物金 balance for the member centre. Renders nothing for an account with no
 * credit history, so a shop that has not switched the gift on sees no dead card.
 */
export async function MemberCreditCard() {
  const credit = await getMemberCredit()
  if (credit.entries.length === 0) return null

  return (
    <section className="account-section member-credit-card">
      <header>
        <div><p className="eyebrow">store credit</p><h2>我的購物金</h2></div>
        <strong>{formatTwd(credit.balance)}</strong>
      </header>
      <p className="member-credit-note">
        {credit.balance > 0
          ? '下次結帳會自動折抵，不需要輸入優惠碼。'
          : '購物金已使用完畢。'}
      </p>
      <ul className="member-credit-log">
        {credit.entries.slice(0, 5).map((entry) => (
          <li key={`${entry.createdAt}-${entry.amount}`}>
            <span>{reasonLabels[entry.reason] ?? entry.reason}</span>
            <strong data-spend={entry.amount < 0}>
              {entry.amount > 0 ? '+' : '−'}{formatTwd(Math.abs(entry.amount))}
            </strong>
          </li>
        ))}
      </ul>
    </section>
  )
}
