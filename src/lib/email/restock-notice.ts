import 'server-only'

import { absoluteUrl } from '@/lib/site'
import { formatTwd } from '@/lib/money'
import { sendEmail, type SendEmailResult } from '@/lib/email/resend'

/** Sent once, by the daily cron, when a waited-for product is back in stock. */
export type RestockNoticeEmail = {
  email: string
  productName: string
  productSlug: string
  price: number
  imageUrl?: string | null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderRestockNoticeEmail(notice: RestockNoticeEmail): { subject: string; html: string } {
  const productUrl = absoluteUrl(`/products/${notice.productSlug}`)
  const subject = `【MORIMUR BABY】${notice.productName} 補貨到了`
  const image = notice.imageUrl
    ? `<img src="${escapeHtml(notice.imageUrl)}" alt="" width="200" style="display:block;margin:0 auto 20px;border-radius:10px;">`
    : ''

  const html = `
  <div style="margin:0;padding:24px;background:#f0f4f6;font-family:'Helvetica Neue',Arial,'PingFang TC','Microsoft JhengHei',sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <div style="padding:28px 32px;background:#6a7f90;color:#ffffff;">
        <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#cdd9e2;">MORIMUR BABY</p>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:500;">你等的商品補貨了</h1>
      </div>
      <div style="padding:28px 32px;">
        ${image}
        <p style="margin:0 0 6px;text-align:center;font-size:18px;font-weight:700;color:#52667a;">${escapeHtml(notice.productName)}</p>
        <p style="margin:0 0 22px;text-align:center;color:#4c4c4c;">${escapeHtml(formatTwd(notice.price))} 起</p>
        <p style="margin:0 0 24px;color:#4c4c4c;line-height:1.7;">
          之前你登記了這件商品的到貨通知，現在已經可以下單了。
          補貨數量有限，建議儘早選好尺寸結帳。
        </p>
        <div style="text-align:center;">
          <a href="${productUrl}" style="display:inline-block;padding:12px 26px;background:#6a7f90;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700;">看看這件商品</a>
        </div>
        <p style="margin:20px 0 0;color:#8b8b8b;font-size:13px;text-align:center;">
          這封通知只會寄送一次；若要再次追蹤，可以到商品頁重新登記。
        </p>
      </div>
    </div>
    <p style="max-width:560px;margin:16px auto 0;color:#b0aca4;font-size:12px;text-align:center;">此信件由系統自動發送。</p>
  </div>`

  return { subject, html }
}

export async function sendRestockNoticeEmail(notice: RestockNoticeEmail): Promise<SendEmailResult> {
  const { subject, html } = renderRestockNoticeEmail(notice)
  return sendEmail({ to: notice.email, subject, html })
}
