import { formatTwd } from '@/lib/money'
import { getActiveWelcomeGift } from '@/features/marketing/welcome-gift'

/**
 * The pre-signup pitch. Renders nothing unless the shop has switched the gift
 * on, so callers can drop it in unconditionally. After signing up the gift is a
 * 購物金 balance (see MemberCreditCard) — no code to copy.
 */
export async function WelcomeGiftCard() {
  const gift = await getActiveWelcomeGift()
  if (!gift) return null

  return (
    <aside className="welcome-gift" data-variant="invite">
      <p className="welcome-gift-label">新會員禮</p>
      <strong>註冊就送 {formatTwd(gift.amount)} 購物金</strong>
      <p>註冊完成後直接入帳，下次結帳自動折抵，不用輸入優惠碼。</p>
    </aside>
  )
}
