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

  return (
    <main className="section admin-management-page">
      <header className="admin-page-heading">
        <div><p className="eyebrow">store preferences</p><h1>商店設定</h1></div>
        <p>集中管理配送、搜尋呈現、網站分析與首頁內容。</p>
      </header>
      <section className="admin-panel admin-settings-panel">
      <header><div><p className="eyebrow">shipping & contact</p><h2>配送與聯絡資料</h2></div></header>
      <form action={updateStoreSettingsFromForm} className="admin-stack-form">
        <label>
          運費
          <input defaultValue={settings.shippingFee} min="0" name="shippingFee" required step="1" type="number" />
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
        </label>
        <label>
          聯絡 Email
          <input defaultValue={settings.contactEmail} name="contactEmail" required type="email" />
        </label>
        <div className="admin-settings-divider"><span>SEO 與網站流量</span></div>
        <label>
          網站主標題
          <input defaultValue={settings.siteTitle ?? defaultSitePresentation.siteTitle} maxLength={70} name="siteTitle" required />
          <small>建議包含品牌、商品特色與主要客群，最多 70 個字。</small>
        </label>
        <label>
          Description
          <textarea defaultValue={settings.siteDescription ?? defaultSitePresentation.siteDescription} maxLength={160} minLength={20} name="siteDescription" required rows={4} />
          <small>搜尋結果與社群分享會使用這段摘要，建議 80–160 個字。</small>
        </label>
        <fieldset className="admin-keyword-fields"><legend>關鍵字設定（最多 5 組）</legend><div>{Array.from({ length: 5 }, (_, index) => <label key={index}>關鍵字 {index + 1}<input defaultValue={(settings.siteKeywords ?? defaultSitePresentation.siteKeywords)[index] ?? ''} maxLength={40} name={`siteKeyword-${index}`} placeholder={index === 0 ? '例：台灣童裝' : ''} /></label>)}</div></fieldset>
        <label>
          Google Analytics 4 Measurement ID（選填）
          <input defaultValue={settings.googleAnalyticsId ?? ''} name="googleAnalyticsId" pattern="G-[A-Za-z0-9]+" placeholder="G-XXXXXXXXXX" />
          <small>填入 G- 開頭的 ID 才會載入 Google tag；留白時不會傳送資料。</small>
        </label>
        <button className="button" type="submit">儲存設定</button>
      </form>
      </section>
      <section className="admin-panel admin-banner-settings">
        <header><div><p className="eyebrow">homepage carousel</p><h2>首頁輪播圖</h2></div><p>可編輯每張主視覺的圖片、文案與站內連結；保留空白的新欄位不會建立輪播。</p></header>
        <BannerSettingsEditor action={updateBannerSlidesFromForm} slides={bannerSlides} />
      </section>
      <section className="admin-panel admin-integration-settings">
        <header><div><p className="eyebrow">payments, shipping & seo</p><h2>付款、物流與搜尋設定</h2></div></header>
        <div className="integration-grid">
          <article><span data-status="active">目前可用</span><h3>7-ELEVEN／全家取貨</h3><p>前台可透過綠界電子地圖選擇取貨門市；出貨採手動方式（如 7-11 賣貨便）處理。</p></article>
          <article><span data-status="active">目前可用</span><h3>銀行匯款</h3><p>送出訂單後顯示收款帳號，會員可回報帳號末 5 碼供後台核對。</p></article>
          <article><span data-status="active">目前可用</span><h3>SEO 與社群預覽</h3><p>已設定網站名稱、摘要、社群分享卡片與正式網域。</p></article>
        </div>
      </section>
    </main>
  )
}
