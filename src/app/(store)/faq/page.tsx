import Link from 'next/link'
import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/site'
import { formatTwd } from '@/lib/money'
import { getStorefrontSettings } from '@/features/checkout/settings'

// The free-shipping threshold comes from 商店設定, so render per-request
// rather than freezing the value into a static page at build time.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '常見問題',
  description: '配送、付款、退換貨、尺寸與會員相關的常見問答。',
  alternates: { canonical: absoluteUrl('/faq') },
}

type FaqItem = { q: string; a: React.ReactNode }
type FaqGroup = { eyebrow: string; heading: string; items: FaqItem[] }

const buildFaqGroups = (freeShipping: string | null): FaqGroup[] => [
  {
    eyebrow: 'shipping',
    heading: '配送與取貨',
    items: [
      { q: '有哪些配送方式？', a: `目前僅提供 7-ELEVEN 超商取貨，配送範圍為台灣本島。${freeShipping ? `單筆訂單滿 ${freeShipping} 即享免運。` : ''}` },
      { q: '多久會出貨？', a: '現貨下單後 1–3 個工作天，預購商品約 14–21 個工作天內出貨（不含週末與國定假日），出貨後會以 Email 通知取貨門市與代碼。' },
      { q: '可以寄送到外島或海外嗎？', a: '目前僅支援台灣本島超商取貨，暫不提供外島宅配與海外配送。' },
    ],
  },
  {
    eyebrow: 'payment',
    heading: '付款方式',
    items: [
      { q: '提供哪些付款方式？', a: '目前採用銀行匯款（ATM／網路銀行轉帳）。下單後會顯示收款帳號，完成匯款後請回報帳號末 5 碼供核對。' },
      { q: '轉帳後需要做什麼？', a: <>完成轉帳後，請至 <Link href="/order-lookup">訂單查詢</Link> 或會員中心回報帳號末五碼，我們核帳後即安排出貨。</> },
    ],
  },
  {
    eyebrow: 'returns',
    heading: '退換貨',
    items: [
      { q: '可以退換貨嗎？', a: <div className="faq-policy-copy">
        <p><strong>商品售出後不做退換</strong>，再麻煩各位媽咪下單前確認好尺寸、顏色及款式；如真的不確定，歡迎先訊息詢問我們。</p>
        <p>出貨前，商品皆會檢查是否有瑕疵與損壞；如有問題會提前訊息告知，確認要更換或退款。</p>
        <ul>
          <li>商品有瑕疵，或收到與訂單不符的款式、顏色，請於收到後 3 日內拍照聯絡我們，一定負責更換或退款。</li>
          <li>訂單尚未出貨前，可留言更改尺寸或顏色，我們會確認現貨後調整。</li>
          <li>新品布料或染劑氣味通風後會逐漸散去，單純氣味不列為瑕疵。</li>
          <li>店到店逾期未領遭退回，重新寄送運費由買方負擔。</li>
        </ul>
      </div> },
      { q: '瑕疵品如何定義？', a: <div className="faq-policy-copy">
        <p>需有明顯污穢、破損或缺件，並請拍照清楚標示瑕疵處。</p>
        <strong>✓ 以下情況原則上屬非瑕疵狀況</strong>
        <p>線頭、照片色差、合理尺寸誤差、鈕扣記號、扣眼與口袋縫線未開、布料氣味、極細微污點等。</p>
        <p>如有氣味、穿戴痕跡、髒污、洗滌、下水或剪標等使用痕跡，恕無法以商品瑕疵辦理。</p>
      </div> },
      { q: '退款多久會到帳？', a: '我們收到退回商品並檢查無誤後，約 3–7 個工作天退回原付款方式。' },
    ],
  },
  {
    eyebrow: 'sizing',
    heading: '尺寸與商品',
    items: [
      { q: '如何挑選尺寸？', a: '每件商品頁都附有身高與年齡對照表；若介於兩個尺寸之間，建議選大一號，孩子成長得很快。如真的不清楚，歡迎訊息詢問我們唷。' },
      { q: '缺貨的商品會補貨嗎？', a: <>缺貨或即將上架的商品可先加入 <Link href="/wishlist">收藏清單</Link>，補貨時方便快速找到。</> },
    ],
  },
  {
    eyebrow: 'members',
    heading: '會員與訂單',
    items: [
      { q: '一定要註冊會員嗎？', a: '瀏覽商品與加入購物車不需要登入；送出訂單前必須建立會員並登入，方便查看訂單與取貨進度。' },
      { q: '忘記訂單編號怎麼辦？', a: <>可用下單時的 Email 於<Link href="/order-lookup">訪客訂單查詢</Link>查看，或登入<Link href="/account/orders">會員訂單</Link>。</> },
      { q: '要怎麼追蹤訂單狀態？', a: '出貨與到店取貨時皆會以 Email 通知；會員也可隨時在會員中心查看最新進度。' },
    ],
  },
]

export default async function FaqPage() {
  const settings = await getStorefrontSettings()
  const faqGroups = buildFaqGroups(
    settings.freeShippingThreshold ? formatTwd(settings.freeShippingThreshold) : null,
  )
  return (
    <main className="section faq-page">
      <header className="page-heading faq-heading">
        <p>help center</p>
        <h1>常見問題</h1>
        <span>整理了大家最常詢問的配送、付款與退換貨問題。找不到答案的話，歡迎來信 <a href="mailto:moribaby0612@gmail.com">moribaby0612@gmail.com</a>。</span>
      </header>

      <div className="faq-groups">
        {faqGroups.map((group) => (
          <section className="faq-group" key={group.heading} aria-labelledby={`faq-${group.eyebrow}`}>
            <div className="faq-group-head">
              <p className="eyebrow">{group.eyebrow}</p>
              <h2 id={`faq-${group.eyebrow}`}>{group.heading}</h2>
            </div>
            <div className="faq-list">
              {group.items.map((item) => (
                <details className="faq-item" key={item.q}>
                  <summary>{item.q}<span className="faq-item-icon" aria-hidden="true" /></summary>
                  <div className="faq-answer">{typeof item.a === 'string' ? <p>{item.a}</p> : item.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
