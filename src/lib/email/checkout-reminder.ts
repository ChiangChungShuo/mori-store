import 'server-only'

import { getBankTransferInfo } from '@/features/checkout/bank-transfer'
import { absoluteUrl } from '@/lib/site'
import { formatTwd } from '@/lib/money'
import { sendEmail, type SendEmailResult } from '@/lib/email/resend'

export type CheckoutReminderEmail = {
  email: string
  recipientName?: string
  subject: string
  items: Array<{ productName: string; color: string; size: string; quantity: number; unitPrice: number }>
  total: number
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

// One gentle nudge for a shopper who completed checkout but has not paid yet.
export async function sendCheckoutReminderEmail(reminder: CheckoutReminderEmail): Promise<SendEmailResult> {
  const bank = getBankTransferInfo()
  const rows = reminder.items.map((item) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e4eaee;color:#414e59;font-size:14px;">
        ${escapeHtml(item.productName)}<br />
        <span style="color:#7c8a96;font-size:12px;">${escapeHtml(item.color)}／尺寸 ${escapeHtml(item.size)} × ${item.quantity}</span>
      </td>
      <td align="right" style="padding:8px 0;border-bottom:1px solid #e4eaee;color:#414e59;font-size:14px;">
        ${formatTwd(item.unitPrice * item.quantity)}
      </td>
    </tr>`).join('')

  const html = `
  <div style="margin:0 auto;max-width:34rem;background:#ffffff;border:1px solid #dde5ea;border-radius:12px;overflow:hidden;font-family:'PingFang TC','Noto Sans TC',sans-serif;">
    <div style="background:#6a7f90;padding:20px 24px;color:#ffffff;">
      <p style="margin:0;font-size:12px;letter-spacing:0.14em;">MORIMUR BABY</p>
      <p style="margin:6px 0 0;font-size:18px;font-weight:700;">您的訂單還差最後一步</p>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 14px;color:#414e59;font-size:14px;line-height:1.8;">
        ${reminder.recipientName ? `${escapeHtml(reminder.recipientName)} 您好，` : '您好，'}
        您先前挑選的商品已為您保留訂單資料，完成匯款後我們就會盡快安排出貨。
      </p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="margin:14px 0 0;text-align:right;color:#414e59;font-size:15px;font-weight:700;">
        應付金額 ${formatTwd(reminder.total)}
      </p>
      <div style="margin:18px 0;background:#f4f8f9;border:1px solid #dde5ea;border-radius:8px;padding:14px 16px;color:#52667a;font-size:13px;line-height:1.9;">
        匯款資訊：${escapeHtml(bank.bankName)}（${escapeHtml(bank.bankCode)}）<br />
        帳號：${escapeHtml(bank.accountNumber)}<br />
        戶名：${escapeHtml(bank.accountName)}<br />
        完成匯款後，請至「免登入查詢訂單」回報帳號末五碼，我們會盡快對帳出貨。
      </div>
      <p style="margin:0;text-align:center;">
        <a href="${absoluteUrl('/order-lookup')}" style="display:inline-block;background:#6a7f90;color:#ffffff;border-radius:999px;padding:11px 28px;font-size:14px;text-decoration:none;">查詢我的訂單</a>
      </p>
      <p style="margin:18px 0 0;color:#7c8a96;font-size:12px;line-height:1.8;">
        若您已完成付款請忽略此信；有任何問題歡迎直接回覆，我們很樂意協助。
      </p>
    </div>
  </div>`

  return sendEmail({
    to: reminder.email,
    subject: reminder.subject,
    html,
  })
}
