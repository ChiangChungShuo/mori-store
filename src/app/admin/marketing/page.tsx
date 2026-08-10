import { createPromotionFromForm, deletePromotionFromForm, getMarketingDashboard, togglePromotionFromForm, updateReminderFromForm } from '@/features/admin/business-management'
import { getWelcomeGiftSettings, saveWelcomeGiftFromForm } from '@/features/marketing/welcome-gift'
import { countMarketingSubscribers, sendMarketingBroadcastFromForm } from '@/features/admin/marketing-broadcast'
import { couponUsageLimitLabels } from '@/features/checkout/coupons'
import { MarketingBroadcastForm } from '@/features/admin/marketing-broadcast-form'
import { CustomerPhotoManager } from '@/features/admin/customer-photo-manager'
import { addCustomerPhotoFromForm, deleteCustomerPhotoFromForm, listCustomerPhotos } from '@/features/storefront/customer-photos'
import { listAdminProducts } from '@/features/admin/product-actions'
import { formatTaipeiDateTime } from '@/lib/date-time'

export const dynamic = 'force-dynamic'

// 「滿件折」已移除：多件優惠改由商品頁的「多件優惠價」設定。
const promotionTypeLabels: Record<string, string> = {
  coupon: '折扣碼',
  threshold_gift: '滿額贈',
}

export default async function AdminMarketingPage() {
  const [dashboard, subscriberCount, customerPhotos, adminProducts, welcomeGift] = await Promise.all([
    getMarketingDashboard(),
    countMarketingSubscribers(),
    listCustomerPhotos(),
    listAdminProducts(),
    getWelcomeGiftSettings(),
  ])
  const productOptions = adminProducts.map((product) => ({ id: product.id, name: product.name }))

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
              <span>{promotionTypeLabels[promotion.type] ?? promotion.type}</span>
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
            {/* Coupon codes are the only promotion the checkout actually applies,
                so the type picker and the gift field are gone. */}
            <input name="type" type="hidden" value="coupon" />
            <label>活動名稱<input name="name" placeholder="例：開學季折扣" required /></label>
            <div className="form-split"><label>折扣碼<input name="code" placeholder="MORI100" required /></label><label>折抵金額<input defaultValue="100" min="0" name="rewardValue" type="number" /></label></div>
            <label>門檻金額<input defaultValue="1000" min="0" name="conditionValue" type="number" /><small className="admin-field-hint">訂單金額達到門檻才能使用；填 0 代表不限金額。</small></label>
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

        <section className="admin-panel">
          <header><div><p className="eyebrow">welcome gift</p><h2>新會員禮</h2></div><strong>{welcomeGift.enabled ? '啟用中' : '未啟用'}</strong></header>
          <form action={saveWelcomeGiftFromForm} className="admin-stack-form">
            <label className="check-label"><input defaultChecked={welcomeGift.enabled} name="enabled" type="checkbox" />啟用新會員註冊禮</label>
            <label>贈送金額<input defaultValue={welcomeGift.amount} min="0" name="amount" type="number" /><small className="admin-field-hint">新會員第一次進到會員中心時自動入帳，每個帳號只發一次。</small></label>
            <input name="code" type="hidden" value={welcomeGift.code} />
            <input name="minimumSpend" type="hidden" value={welcomeGift.minimumSpend} />
            <button className="button" type="submit">儲存新會員禮</button>
            <p className="admin-panel-note">這是購物金，不是優惠碼：會員結帳時自動折抵，不需要輸入任何代碼。金額會從應付總額扣除，扣完就沒有了；訂單取消不會退回購物金。</p>
          </form>
        </section>

        <section className="admin-panel abandoned-panel">
          <header><div><p className="eyebrow">cart recovery</p><h2>未結帳購物車提醒</h2></div><strong>{dashboard.abandonedCarts} 筆待付款訂單（7 天內）</strong></header>
          {dashboard.reminder ? <form action={updateReminderFromForm} className="admin-stack-form">
            <label className="check-label"><input defaultChecked={dashboard.reminder.enabled} name="enabled" type="checkbox" />啟用提醒排程</label>
            <div className="form-split"><label>延遲時數<input defaultValue={dashboard.reminder.delayHours} max="168" min="1" name="delayHours" type="number" /></label><label>信件主旨<input defaultValue={dashboard.reminder.subject} name="subject" required /></label></div>
            <button type="submit">儲存提醒設定</button>
            <p className="admin-panel-note">啟用後，完成結帳但超過延遲時數仍未付款的訂單，系統會自動寄出一封提醒信（每筆訂單只寄一次，附商品明細與匯款資訊）。</p>
          </form> : <p className="admin-panel-note">提醒設定載入中，請重新整理頁面。</p>}
        </section>
      </div>
      <CustomerPhotoManager addPhoto={addCustomerPhotoFromForm} deletePhoto={deleteCustomerPhotoFromForm} photos={customerPhotos} products={productOptions} />
      <MarketingBroadcastForm action={sendMarketingBroadcastFromForm} subscriberCount={subscriberCount} />
    </main>
  )
}
