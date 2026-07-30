import type { Metadata } from 'next'
import Link from 'next/link'
import { absoluteUrl } from '@/lib/site'

export const metadata: Metadata = {
  title: '聯絡我們',
  description: '有任何關於商品、訂單或合作的問題，歡迎與 mori 童裝商城聯絡。',
  alternates: { canonical: absoluteUrl('/contact') },
}

export default function ContactPage() {
  return (
    <main className="section legal-page contact-page">
      <header className="page-heading">
        <p>contact</p>
        <h1>聯絡我們</h1>
        <span>有任何關於商品、訂單或合作的問題，都歡迎與我們聯絡，我們會盡快回覆。</span>
      </header>

      <div className="contact-grid">
        <a className="contact-card" href="mailto:moribaby0612@gmail.com">
          <span className="contact-card-icon" aria-hidden="true">✉</span>
          <h2>客服信箱</h2>
          <p>moribaby0612@gmail.com</p>
          <small>一般問題約 1–2 個工作天內回覆</small>
        </a>
        <div className="contact-card">
          <span className="contact-card-icon" aria-hidden="true">🕒</span>
          <h2>客服時間</h2>
          <p>週一至週五 10:00–18:00</p>
          <small>例假日與國定假日暫停服務，來信仍會依序回覆</small>
        </div>
        <Link className="contact-card" href="/order-lookup">
          <span className="contact-card-icon" aria-hidden="true">📦</span>
          <h2>訂單查詢</h2>
          <p>查看出貨與取貨進度</p>
          <small>訪客可用 Email 查詢，會員請至會員訂單</small>
        </Link>
        <Link className="contact-card" href="/returns">
          <span className="contact-card-icon" aria-hidden="true">↩</span>
          <h2>退換貨</h2>
          <p>7 天鑑賞期與退款說明</p>
          <small>符合條件可申請退貨或換貨</small>
        </Link>
      </div>

      <p className="contact-faq-hint">出貨、付款與尺寸等常見疑問，多數可在 <Link href="/faq">常見問題</Link> 找到解答。</p>
    </main>
  )
}
