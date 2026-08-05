import 'server-only'

import { absoluteUrl } from '@/lib/site'
import { sendEmail, type SendEmailResult } from '@/lib/email/resend'

/**
 * Sent when the owner marks an order 已出貨.
 *
 * Convenience-store pickup has a hard deadline (7 days at 7-ELEVEN); an
 * uncollected parcel costs the shop the return shipping, so this mail exists to
 * get the customer to the store in time.
 */
export type OrderShippedEmail = {
  orderNumber: string
  email: string
  recipientName?: string
  storeChain?: string
  storeName?: string
  storeId?: string
  itemCount?: number
}

const CHAIN_LABEL: Record<string, string> = {
  seven_eleven: '7-ELEVEN',
  family_mart: '全家',
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderOrderShippedEmail(order: OrderShippedEmail): { subject: string; html: string } {
  const lookupUrl = absoluteUrl('/order-lookup')
  const chain = CHAIN_LABEL[order.storeChain ?? ''] ?? '超商'
  const storeLine = order.storeName
    ? `${chain}／${escapeHtml(order.storeName)}${order.storeId ? `（店號 ${escapeHtml(order.storeId)}）` : ''}`
    : chain
  const greeting = order.recipientName ? `${escapeHtml(order.recipientName)}，你好：` : '你好：'
  const subject = `【MORIMUR BABY】商品已出貨 ${order.orderNumber}`

  const html = `
  <div style="margin:0;padding:24px;background:#f0f4f6;font-family:'Helvetica Neue',Arial,'PingFang TC','Microsoft JhengHei',sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <div style="padding:28px 32px;background:#6a7f90;color:#ffffff;">
        <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#cdd9e2;">MORIMUR BABY</p>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:500;">包裹已出貨，正在前往門市</h1>
      </div>
      <div style="padding:28px 32px;">
        <p style="margin:0 0 16px;color:#4c4c4c;">${greeting}</p>
        <p style="margin:0 0 20px;color:#4c4c4c;line-height:1.7;">
          你的訂單${order.itemCount ? `（共 ${order.itemCount} 件商品）` : ''}已經寄出，通常 2–3 個工作日會抵達門市。
          商品到店後，${chain}會發送取貨簡訊或 App 通知給你。
        </p>

        <div style="padding:18px 20px;background:#eef3f5;border-radius:8px;">
          <p style="margin:0 0 4px;color:#8b8b8b;font-size:13px;">訂單編號</p>
          <p style="margin:0 0 14px;font-size:18px;font-weight:700;color:#52667a;letter-spacing:0.04em;">${escapeHtml(order.orderNumber)}</p>
          <p style="margin:0 0 4px;color:#8b8b8b;font-size:13px;">取貨門市</p>
          <p style="margin:0;color:#4c4c4c;font-weight:700;">${storeLine}</p>
        </div>

        <p style="margin:22px 0 0;padding:14px 16px;background:#fdf6f1;border-radius:8px;color:#8f6449;font-size:14px;line-height:1.7;">
          請留意：包裹到店後<strong>保留 7 天</strong>，逾期未取會自動退回，需要重新下單。
          取貨時請帶手機號碼或訂單編號給店員即可。
        </p>

        <div style="margin-top:28px;text-align:center;">
          <a href="${lookupUrl}" style="display:inline-block;padding:12px 26px;background:#6a7f90;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700;">查詢訂單進度</a>
        </div>
        <p style="margin:18px 0 0;color:#8b8b8b;font-size:13px;text-align:center;">
          有任何問題可直接回信或到商店的聯絡我們頁面留言。
        </p>
      </div>
    </div>
    <p style="max-width:560px;margin:16px auto 0;color:#b0aca4;font-size:12px;text-align:center;">此信件由系統自動發送。</p>
  </div>`

  return { subject, html }
}

export async function sendOrderShippedEmail(order: OrderShippedEmail): Promise<SendEmailResult> {
  const { subject, html } = renderOrderShippedEmail(order)
  return sendEmail({ to: order.email, subject, html })
}
