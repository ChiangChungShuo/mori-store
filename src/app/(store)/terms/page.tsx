import type { Metadata } from 'next'
import Link from 'next/link'
import { absoluteUrl } from '@/lib/site'

export const metadata: Metadata = {
  title: '服務條款',
  description: '使用 mori 童裝商城購物前，請詳閱以下服務條款。',
  alternates: { canonical: absoluteUrl('/terms') },
}

export default function TermsPage() {
  return (
    <main className="section legal-page">
      <header className="page-heading">
        <p>terms</p>
        <h1>服務條款</h1>
        <span>歡迎光臨 mori 童裝商城。當你在本站瀏覽或下單，即表示同意以下條款。</span>
      </header>
      <div className="legal-content">
        <section>
          <h2>訂單與成立</h2>
          <p>你送出訂單後即為要約，待我們確認庫存與付款狀態後訂單方為成立。若商品缺貨或標價明顯錯誤，我們保留取消訂單並全額退款的權利。</p>
        </section>
        <section>
          <h2>價格與付款</h2>
          <p>所有價格以新台幣（NT$）標示。目前支援銀行轉帳與超商取貨付款；轉帳訂單需於期限內完成付款並回報，逾期訂單可能被取消。</p>
        </section>
        <section>
          <h2>配送與取貨</h2>
          <p>本站採 7-ELEVEN／全家超商取貨，配送範圍為台灣本島。商品到店後請於超商規定期限內領取，逾期未取件將退回並可能影響後續下單權益。</p>
        </section>
        <section>
          <h2>退換貨</h2>
          <p>退換貨依<Link href="/returns">退換貨政策</Link>辦理。請於收到商品後 7 天鑑賞期內，於商品全新未使用、吊牌與包裝完整下申請。</p>
        </section>
        <section>
          <h2>智慧財產權</h2>
          <p>本站的商標、圖片、文案與版面設計均受法律保護，未經同意不得重製或作商業使用。</p>
        </section>
        <section>
          <h2>條款修改</h2>
          <p>我們可能不定期更新本條款，修改後將於本頁公告，恕不另行個別通知。</p>
        </section>
        <p className="legal-updated">本條款為示範內容，正式上線前請依實際營運與當地法規調整。</p>
      </div>
    </main>
  )
}
