import { createPromotionFromForm, deletePromotionFromForm, getMarketingDashboard, togglePromotionFromForm, updateReminderFromForm } from '@/features/admin/business-management'
import { countMarketingSubscribers, sendMarketingBroadcastFromForm } from '@/features/admin/marketing-broadcast'
import { couponUsageLimitLabels } from '@/features/checkout/coupons'
import { MarketingBroadcastForm } from '@/features/admin/marketing-broadcast-form'
import { formatTaipeiDateTime } from '@/lib/date-time'

export const dynamic = 'force-dynamic'

const promotionTypeLabels = {
  coupon: '折扣碼',
  threshold_gift: '滿額贈',
  quantity_discount: '滿件折',
}

export default async function AdminMarketingPage() {
  const [dashboard, subscriberCount] = await Promise.all([getMarketingDashboard(), countMarketingSubscribers()])

  return (
    <main className="section admin-management-page">
      <header className="admin-page-heading">
        <div><p className="eyebrow">campaign studio</p><h1>行銷推廣</h1></div>
        <p>建立促銷活動，並追蹤加入購物車後尚未結帳的顧客。</p>
      </header>

      <div className="admin-dashboard-grid admin-marketing-grid">
        <section className="admin-panel">
          <header><div><p className="eyebrow">promotions</p><h2>促銷活動</h2></div><strong>{dashboard.promotions.filter((item) => item.active).length} 個啟用中</strong></header>
          <div className="promotion-list">{dashboard.promotions.map((promotion) => (
            <article key={promotion.id}>
              <span>{promotionTypeLabels[promotion.type]}</span>
              <div>
                <strong>{promotion.name}</strong>
                <small>{promotion.code || promotion.giftName || `條件 ${promotion.conditionValue}`}</small>
                <small className="promotion-terms">
                  {promotion.startsAt || promotion.endsAt
                    ? `${promotion.startsAt ? formatTaipeiDateTime(promotion.startsAt) : '不限開始'} ～ ${promotion.endsAt ? formatTaipeiDateTime(promotion.endsAt) : '不限結束'}`
                    : '無使用期限'}
                  ・{couponUsageLimitLabels[promotion.usageLimit ?? 'unlimited']}
                  {promotion.endsAt && new Date(promotion.endsAt) < new Date() ? '・已過期' : ''}
                </small>
              </div>
              <div className="promotion-actions">
                <form action={togglePromotionFromForm}><input name="id" type="hidden" value={promotion.id} /><button data-active={promotion.active} type="submit">{promotion.active ? '啟用中' : '已停用'}</button></form>
                <form action={deletePromotionFromForm}><input name="id" type="hidden" value={promotion.id} /><button aria-label={`刪除 ${promotion.name}`} className="promotion-delete" type="submit">刪除</button></form>
              </div>
            </article>
          ))}</div>
        </section>

        <section className="admin-panel">
          <header><div><p className="eyebrow">new campaign</p><h2>新增活動</h2></div></header>
          <form action={createPromotionFromForm} className="admin-stack-form">
            <label>活動名稱<input name="name" placeholder="例：開學季滿額贈" required /></label>
            <label>活動類型<select name="type"><option value="coupon">折扣碼</option><option value="threshold_gift">滿額贈</option><option value="quantity_discount">滿件折</option></select></label>
            <div className="form-split"><label>折扣碼<input name="code" placeholder="MORI100" /></label><label>門檻金額／件數<input defaultValue="1000" min="0" name="conditionValue" type="number" /></label></div>
            <div className="form-split"><label>折抵金額／折數 %<input defaultValue="100" min="0" name="rewardValue" type="number" /></label><label>贈品名稱<input name="giftName" placeholder="適用滿額贈" /></label></div>
            <div className="form-split">
              <label>開始時間（選填）<input name="startsAt" type="datetime-local" /></label>
              <label>結束時間（選填）<input name="endsAt" type="datetime-local" /></label>
            </div>
            <label>使用限制<select defaultValue="unlimited" name="usageLimit">
              <option value="unlimited">不限次數</option>
              <option value="once_total">全站僅能使用一次</option>
              <option value="once_per_account">每個帳號限用一次</option>
            </select><small className="admin-field-hint">時間留空代表不限；超過結束時間後優惠碼會自動失效。</small></label>
            <label className="check-label"><input defaultChecked name="active" type="checkbox" />建立後立即啟用</label>
            <button className="button" type="submit">建立活動</button>
          </form>
        </section>

        <section className="admin-panel abandoned-panel">
          <header><div><p className="eyebrow">cart recovery</p><h2>未結帳購物車提醒</h2></div><strong>{dashboard.abandonedCarts} 個未完成結帳</strong></header>
          {dashboard.reminder ? <form action={updateReminderFromForm} className="admin-stack-form">
            <label className="check-label"><input defaultChecked={dashboard.reminder.enabled} name="enabled" type="checkbox" />啟用提醒排程</label>
            <div className="form-split"><label>延遲時數<input defaultValue={dashboard.reminder.delayHours} max="168" min="1" name="delayHours" type="number" /></label><label>信件主旨<input defaultValue={dashboard.reminder.subject} name="subject" required /></label></div>
            <button type="submit">儲存提醒設定</button>
            <p className="admin-panel-note">訂單確認信已可正常寄送（Resend）；此「未結帳自動提醒」的排程功能仍在規劃中。</p>
          </form> : <p className="admin-panel-note">訂單確認信已可正常寄送（Resend）。此「未結帳自動提醒」的自動排程功能仍在規劃中，敬請期待。</p>}
        </section>
      </div>
      <MarketingBroadcastForm action={sendMarketingBroadcastFromForm} subscriberCount={subscriberCount} />
    </main>
  )
}
