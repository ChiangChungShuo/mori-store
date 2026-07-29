import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'

export function SiteFooter() {
  return (
    <footer className="site-footer-shell">
      <div className="site-footer">
        <section className="footer-brand-block">
          <div className="footer-brand-lockup">
            <div className="brand" aria-label="MORIMUR BABY"><BrandLogo /></div>
            <div className="footer-brand-copy">
              <h2>把舒服穿進<br />每一天的成長。</h2>
              <p>為 0–12 歲孩子選進親膚、耐穿，也能自在活動的日常服。</p>
              <a href="mailto:hello@mori.tw">hello@mori.tw</a>
            </div>
          </div>
        </section>
        <nav aria-label="購物指南"><strong>購物指南</strong><Link href="/products">所有商品</Link><Link href="/cart">購物車</Link><Link href="/order-lookup">訪客訂單查詢</Link><Link href="/account/orders">會員訂單</Link><Link href="/faq">常見問題</Link></nav>
        <nav aria-label="會員服務"><strong>會員服務</strong><Link href="/account">會員中心</Link><Link href="/login">會員登入</Link><Link href="/signup">建立帳號</Link><Link href="/contact">聯絡我們</Link></nav>
        <section className="footer-service"><strong>配送與服務</strong><p>7-ELEVEN／全家<br />台灣本島超商取貨</p><p>客服時間<br />週一至週五 10:00–18:00</p><div className="footer-payments"><span>VISA</span><span>MC</span><span>JCB</span></div></section>
      </div>
      <div className="footer-bottom"><p>© 2026 mori kids select</p><nav className="footer-legal" aria-label="政策與條款"><Link href="/privacy">隱私權政策</Link><Link href="/terms">服務條款</Link><Link href="/returns">退換貨政策</Link><Link href="/faq">常見問題</Link></nav></div>
    </footer>
  )
}
