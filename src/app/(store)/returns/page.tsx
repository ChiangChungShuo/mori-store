import type { Metadata } from 'next'
import Link from 'next/link'
import { absoluteUrl } from '@/lib/site'

export const metadata: Metadata = {
  title: '退換貨政策',
  description: 'MORIMUR BABY 商品售出後不做退換；瑕疵品與寄錯商品的處理方式說明。',
  alternates: { canonical: absoluteUrl('/returns') },
}

export default function ReturnsPage() {
  return (
    <main className="section legal-page">
      <header className="page-heading">
        <p>returns</p>
        <h1>退換貨政策</h1>
        <span>售出後不做退換，下單前請務必確認尺寸與顏色；瑕疵與寄錯商品我們一定負責處理。</span>
      </header>
      <div className="legal-content">
        <section>
          <h2>購買前請確認</h2>
          <p>購買前請確認尺寸、顏色、款式與商品描述，同意後再行購買。若有疑慮，歡迎先聯絡客服詳細諮詢。</p>
          <p>闆闆在商品包裝寄送前，都會仔細核對每一筆訂單，並檢查衣服狀況與外觀；若發現瑕疵或品質未達標準，會主動留言確認退貨退款或更換方式，請各位媽咪放心。</p>
          <p>若仍有檢查疏漏或衣服細部重大瑕疵，真的非常抱歉，請立刻聯絡我們協助處理。</p>
        </section>
        <section>
          <h2>售出後不做退換</h2>
          <p>本店商品售出後不提供退換貨服務，再麻煩各位媽咪下單前確認好尺寸、顏色及款式；如真的不確定，歡迎先訊息詢問我們。</p>
          <p>唯以下兩種情況，我們一定負責處理：<strong>商品有瑕疵</strong>，或<strong>收到的商品與訂單款式、顏色不符</strong>——將協助更換或退款。</p>
        </section>
        <section>
          <h2>出貨前仍可修改</h2>
          <p>訂單尚未出貨前，如需更改尺寸或顏色，請盡快於訂單留言或私訊告知，我們會確認現貨後為您調整。</p>
        </section>
        <section>
          <h2>瑕疵品定義</h2>
          <p>瑕疵品需有明顯污穢、破損或缺件，申請時請拍照清楚標示瑕疵處。</p>
          <ul>
            <li>以下屬於服飾製程中的合理狀況，原則上不列為瑕疵：線頭、照片色差、合理尺寸誤差、鈕扣記號、扣眼與口袋縫線未開、布料氣味、極細微污點等。</li>
            <li>如有氣味、穿戴痕跡、髒污、洗滌、下水或剪標等使用痕跡，恕無法以商品瑕疵辦理。</li>
          </ul>
        </section>
        <section>
          <h2>其他注意事項</h2>
          <ul>
            <li>新品可能帶有布料或染劑氣味，通風放置後會逐漸散去；單純布料氣味不列為瑕疵。</li>
            <li>店到店包裹因逾期未領遭退回時，買方需負擔重新寄送的運費；完成匯款後約 2–3 個工作天再次寄出。</li>
          </ul>
        </section>
        <section>
          <h2>申請方式與退款</h2>
          <ul>
            <li>來信 <a href="mailto:moribaby0612@gmail.com">moribaby0612@gmail.com</a>、私訊 Instagram <a href="https://www.instagram.com/mori.murbebe/" rel="noreferrer" target="_blank">@mori.murbebe</a>，或於訂單留言，附上訂單編號、申請原因與瑕疵照片。</li>
            <li>瑕疵或寄錯商品請於收到後 3 日內告知；我們確認後會回覆寄回方式，收到商品並檢查無誤後，換貨將重新出貨，退款約 3–7 個工作天辦理。</li>
          </ul>
        </section>
        <p>更多常見問題請見 <Link href="/faq">常見問題</Link>。</p>
      </div>
    </main>
  )
}
