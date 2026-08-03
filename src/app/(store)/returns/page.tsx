import type { Metadata } from 'next'
import Link from 'next/link'
import { absoluteUrl } from '@/lib/site'

export const metadata: Metadata = {
  title: '退換貨政策',
  description: 'MORIMUR BABY 七日解除權、退貨申請，以及瑕疵品與寄錯商品的處理方式說明。',
  alternates: { canonical: absoluteUrl('/returns') },
}

export default function ReturnsPage() {
  return (
    <main className="section legal-page">
      <header className="page-heading">
        <p>returns</p>
        <h1>退換貨政策</h1>
        <span>下單前請確認商品資訊；收到商品後如需退貨，或發現瑕疵與寄錯情形，請依以下方式聯繫我們。</span>
      </header>
      <div className="legal-content">
        <section>
          <h2>購買前請確認</h2>
          <p>購買前請確認尺寸、顏色、款式與商品描述，同意後再行購買。若有疑慮，歡迎先聯絡客服詳細諮詢。</p>
          <p>闆闆在商品包裝寄送前，都會仔細核對每一筆訂單，並檢查衣服狀況與外觀；若發現瑕疵或品質未達標準，會主動留言確認退貨退款或更換方式，請各位媽咪放心。</p>
          <p>若仍有檢查疏漏或衣服細部重大瑕疵，真的非常抱歉，請立刻聯絡我們協助處理。</p>
        </section>
        <section>
          <h2>七日解除權</h2>
          <p>本店一般網購商品依法提供收貨次日起七日解除權，無須說明理由；鑑賞期並非試用期。</p>
          <p>預購僅代表延後出貨，除非商品確實依消費者個別需求製作並於購買前明確告知，否則仍適用七日解除權。</p>
          <p>除依法得行使的七日解除權，以及商品瑕疵、寄錯或缺件情形外，<strong>商品售出後不做退換</strong>。</p>
          <p>如需辦理退貨，請於期限內聯繫客服，並盡量保持商品本體、吊牌、配件及包裝完整。因必要檢查而拆封不影響解除權；若因超出必要檢查範圍而造成商品價值減損，將依相關規定處理。</p>
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
            <li>一般退貨請於收貨次日起七日內聯繫；瑕疵、寄錯或缺件請儘速拍照告知。為協助釐清商品與物流狀況，建議開箱時全程錄影。</li>
            <li>我們確認申請後會回覆寄回方式；收到商品並檢查無誤後，換貨將重新出貨，退款約 3–7 個工作天辦理。</li>
          </ul>
        </section>
        <p>更多常見問題請見 <Link href="/faq">常見問題</Link>。</p>
      </div>
    </main>
  )
}
