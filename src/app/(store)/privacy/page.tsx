import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/site'

export const metadata: Metadata = {
  title: '隱私權政策',
  description: 'mori 童裝商城如何蒐集、使用與保護你的個人資料。',
  alternates: { canonical: absoluteUrl('/privacy') },
}

export default function PrivacyPage() {
  return (
    <main className="section legal-page">
      <header className="page-heading">
        <p>privacy</p>
        <h1>隱私權政策</h1>
        <span>我們重視你的個人資料保護。以下說明我們如何蒐集、使用與保存你的資訊。</span>
      </header>
      <div className="legal-content">
        <section>
          <h2>我們蒐集的資料</h2>
          <p>當你下單、註冊會員或聯絡我們時，我們會蒐集必要的資料，包括姓名、電話、Email、超商取貨門市，以及訂單內容。付款相關資訊由金流／銀行處理，我們不會儲存你的完整信用卡號。</p>
        </section>
        <section>
          <h2>資料的使用目的</h2>
          <ul>
            <li>處理訂單、安排出貨與取貨通知。</li>
            <li>提供客服支援與訂單查詢。</li>
            <li>在你同意的範圍內，寄送優惠與新品資訊。</li>
            <li>改善網站體驗與商品服務（匿名統計分析）。</li>
          </ul>
        </section>
        <section>
          <h2>Cookie 與分析</h2>
          <p>本站使用必要性 Cookie 維持購物車與登入狀態，並可能使用流量分析工具了解整體使用情形。你可於瀏覽器設定管理 Cookie。</p>
        </section>
        <section>
          <h2>資料分享</h2>
          <p>我們僅在為完成訂單所必要時，將資料提供給物流／超商與金流服務商。除法律要求外，不會將你的個人資料販售或提供給無關第三方。</p>
        </section>
        <section>
          <h2>你的權利</h2>
          <p>你可隨時要求查詢、更正或刪除你的個人資料，或撤回行銷同意。請來信 <a href="mailto:moribaby0612@gmail.com">moribaby0612@gmail.com</a>，我們將盡快協助處理。</p>
        </section>
      </div>
    </main>
  )
}
