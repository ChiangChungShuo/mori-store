import {
  defaultSitePresentation,
  getStoreSettings,
  updateStoreSettingsFromForm,
} from '@/features/admin/settings-actions'
import { getBannerSlides, updateBannerSlidesFromForm } from '@/features/storefront/banner-settings'
import { BannerSettingsEditor } from '@/features/admin/banner-settings-editor'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const [settings, bannerSlides] = await Promise.all([getStoreSettings(), getBannerSlides()])
  const keywords = settings.siteKeywords ?? defaultSitePresentation.siteKeywords

  return (
    <main className="section admin-management-page">
      <header className="admin-page-heading">
        <div><p className="eyebrow">store preferences</p><h1>商店設定</h1></div>
      </header>
      <p className="admin-page-lead">配送與聯絡資料、搜尋呈現與網站分析都在同一張表單，改完按一次「儲存設定」即可。</p>

      {/* One form, two panels: the fields are grouped by what they affect, but
          they still save together in a single action. */}
      <form action={updateStoreSettingsFromForm} className="admin-settings-form">
        <section className="admin-panel">
          <header><div><p className="eyebrow">shipping & contact</p><h2>配送與聯絡</h2></div></header>
          <div className="admin-settings-grid">
            <label>
              運費
              <input defaultValue={settings.shippingFee} min="0" name="shippingFee" required step="1" type="number" />
              <small>每筆訂單的基本運費。</small>
            </label>
            <label>
              免運門檻
              <input
                defaultValue={settings.freeShippingThreshold ?? ''}
                min="0"
                name="freeShippingThreshold"
                placeholder="留白代表不提供免運"
                step="1"
                type="number"
              />
              <small>前台公告與購物車都會顯示這個金額。</small>
            </label>
            <label className="admin-settings-wide">
              聯絡 Email
              <input defaultValue={settings.contactEmail} name="contactEmail" required type="email" />
              <small>顯示在頁尾與訂單信件，顧客會用這個信箱聯絡你。</small>
            </label>
          </div>
        </section>

        <section className="admin-panel">
          <header><div><p className="eyebrow">search & analytics</p><h2>搜尋呈現與網站分析</h2></div></header>
          <div className="admin-settings-grid">
            <label className="admin-settings-wide">
              網站主標題
              <input defaultValue={settings.siteTitle ?? defaultSitePresentation.siteTitle} maxLength={70} name="siteTitle" required />
              <small>建議包含品牌、商品特色與主要客群，最多 70 個字。</small>
            </label>
            <label className="admin-settings-wide">
              網站描述（Description）
              <textarea defaultValue={settings.siteDescription ?? defaultSitePresentation.siteDescription} maxLength={160} minLength={20} name="siteDescription" required rows={3} />
              <small>搜尋結果與社群分享會使用這段摘要，建議 80–160 個字。</small>
            </label>
            <fieldset className="admin-keyword-fields admin-settings-wide">
              <legend>關鍵字（最多 5 組）</legend>
              <div>
                {Array.from({ length: 5 }, (_, index) => (
                  <label key={index}>
                    關鍵字 {index + 1}
                    <input defaultValue={keywords[index] ?? ''} maxLength={40} name={`siteKeyword-${index}`} placeholder={index === 0 ? '例：台灣童裝' : ''} />
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="admin-settings-wide">
              Google Analytics 4 Measurement ID（選填）
              <input defaultValue={settings.googleAnalyticsId ?? ''} name="googleAnalyticsId" pattern="G-[A-Za-z0-9]+" placeholder="G-XXXXXXXXXX" />
              <small>填入 G- 開頭的 ID 才會載入 Google tag；留白時不會傳送資料。</small>
            </label>
          </div>
        </section>

        <div className="admin-settings-actions">
          <p>儲存後會立即套用到前台。</p>
          <button className="button" type="submit">儲存設定</button>
        </div>
      </form>

      <section className="admin-panel admin-banner-settings">
        <header><div><p className="eyebrow">homepage carousel</p><h2>首頁輪播圖</h2></div><p>可編輯每張主視覺的圖片、文案與站內連結；保留空白的新欄位不會建立輪播。</p></header>
        <BannerSettingsEditor action={updateBannerSlidesFromForm} slides={bannerSlides} />
      </section>
    </main>
  )
}
