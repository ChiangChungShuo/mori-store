import type { Metadata } from 'next'
import Link from 'next/link'
import { absoluteUrl } from '@/lib/site'

export const metadata: Metadata = {
  title: '退換貨政策',
  description: 'mori 童裝商城的 7 天鑑賞期、退換貨流程與退款說明。',
  alternates: { canonical: absoluteUrl('/returns') },
}

export default function ReturnsPage() {
  return (
    <main className="section legal-page">
      <header className="page-heading">
        <p>returns</p>
        <h1>退換貨政策</h1>
        <span>希望每一件都合身好穿。若需要退換，請參考以下說明。</span>
      </header>
      <div className="legal-content">
        <section>
          <h2>7 天鑑賞期</h2>
          <p>依消費者保護法，你享有商品到貨後 7 天的鑑賞期（非試用期）。請在商品保持全新未使用、吊牌與原包裝完整的狀態下申請退換。</p>
        </section>
        <section>
          <h2>不適用退換的情況</h2>
          <ul>
            <li>已下水洗滌、穿著使用或人為污損、破損的商品。</li>
            <li>吊牌剪除或缺少原包裝、贈品的商品。</li>
            <li>商品頁明確標示「不可退換」之出清品。</li>
          </ul>
        </section>
        <section>
          <h2>退換貨流程</h2>
          <ul>
            <li>來信 <a href="mailto:hello@mori.tw">hello@mori.tw</a>，附上訂單編號與退換原因（換貨請註明想更換的尺寸／顏色）。</li>
            <li>我們確認後回覆寄回方式。</li>
            <li>收到退回商品並檢查無誤後，換貨將重新出貨，退貨將辦理退款。</li>
          </ul>
        </section>
        <section>
          <h2>退款方式與時間</h2>
          <p>退款將退回原付款方式；我們收到並檢查商品後，約 3–7 個工作天完成退款作業。實際入帳時間依銀行作業而定。</p>
        </section>
        <section>
          <h2>瑕疵商品</h2>
          <p>若收到商品有瑕疵或出貨錯誤，請於到貨 7 天內來信並附上照片，我們將負擔往返運費為你更換或退款。</p>
        </section>
        <p>更多常見問題請見 <Link href="/faq">常見問題</Link>。</p>
        <p className="legal-updated">本政策為示範內容，正式上線前請依實際營運調整。</p>
      </div>
    </main>
  )
}
