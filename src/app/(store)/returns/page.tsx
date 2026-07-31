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
          <h2>購買前請確認</h2>
          <p>購買前請確認尺寸、顏色、款式與商品描述，同意後再行購買。若有疑慮，歡迎先聯絡客服詳細諮詢。</p>
          <p>闆闆在商品包裝寄送前，都會仔細核對每一筆訂單，並檢查衣服狀況與外觀；若發現瑕疵或品質未達標準，會主動留言確認退貨退款或更換方式，請各位媽咪放心。</p>
          <p>若仍有檢查疏漏或衣服細部重大瑕疵，真的非常抱歉，請立刻聯絡我們協助處理。</p>
        </section>
        <section>
          <h2>7 天鑑賞期與申請期限</h2>
          <p>依消費者保護法，通訊交易原則上享有商品到貨後 7 天解除權（鑑賞期非試用期）。若商品有瑕疵，建議於收到商品後 3 日內透過訂購系統、Instagram 或客服信箱告知並附上照片，以便優先處理；提出申請後請配合於 7 日內寄回商品。</p>
          <p>3 日瑕疵通知是為了加速確認，不影響依法享有的 7 日解除權或其他瑕疵擔保權利。</p>
        </section>
        <section>
          <h2>退回商品須保持完整</h2>
          <ul>
            <li>不得有非檢查必要的使用痕跡，包括氣味（香水味）、穿戴痕跡、髒污、洗滌、下水或剪標等。</li>
            <li>商品、吊牌、原包裝與贈品須保持完整新品狀態。</li>
            <li>若因非檢查必要的使用造成商品毀損、滅失或變更，將依商品減損程度確認是否影響退貨權益。</li>
          </ul>
        </section>
        <section>
          <h2>尺寸、款式與顏色更換</h2>
          <p>如商品選購錯誤需更換尺寸，尚未出貨前請於訂單留言通知客服，確認是否仍有現貨可修改。商品已出貨後若需更換尺寸，請先聯絡客服確認退回方式，再重新下單訂購。</p>
          <p>本店不提供因個人喜好任意更換款式或顏色；若收到的商品與訂單所選款式、顏色明顯不符，將協助更換。依法行使通訊交易解除權者不受此限制。</p>
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
            <li>我們確認後會回覆寄回方式；收到商品並檢查無誤後，換貨將重新出貨，退貨約 3–7 個工作天辦理退款。</li>
          </ul>
        </section>
        <p>更多常見問題請見 <Link href="/faq">常見問題</Link>。</p>
      </div>
    </main>
  )
}
