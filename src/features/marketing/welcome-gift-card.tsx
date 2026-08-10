import { formatTwd } from '@/lib/money'
import { CopyTextButton } from '@/features/admin/copy-text-button'
import { getActiveWelcomeGift } from '@/features/marketing/welcome-gift'

/**
 * Renders nothing unless the shop has switched the gift on, so both callers can
 * drop it in unconditionally. `variant="invite"` is the pre-signup pitch;
 * `variant="member"` hands over the code itself.
 */
export async function WelcomeGiftCard({ variant }: { variant: 'invite' | 'member' }) {
  const gift = await getActiveWelcomeGift()
  if (!gift) return null

  return (
    <aside className="welcome-gift" data-variant={variant}>
      <p className="welcome-gift-label">新會員禮</p>
      <strong>註冊就送 {formatTwd(gift.amount)} 購物金</strong>
      {variant === 'invite' ? (
        <p>建立會員後即可在結帳輸入專屬優惠碼折抵{gift.minimumSpend > 0 ? `，單筆滿 ${formatTwd(gift.minimumSpend)} 可用` : ''}。</p>
      ) : (
        <>
          <p>結帳時輸入這組優惠碼即可折抵 {formatTwd(gift.amount)}{gift.minimumSpend > 0 ? `（單筆滿 ${formatTwd(gift.minimumSpend)} 可用）` : ''}，每個帳號限用一次。</p>
          <div className="welcome-gift-code">
            <code>{gift.code}</code>
            <CopyTextButton copiedLabel="已複製" label="複製優惠碼" text={gift.code} />
          </div>
        </>
      )}
    </aside>
  )
}
