import 'server-only'

import { getBankTransferInfo } from '@/features/checkout/bank-transfer'
import { absoluteUrl } from '@/lib/site'
import { formatTwd } from '@/lib/money'
import { sendEmail, type SendEmailResult } from '@/lib/email/resend'

export type OrderConfirmationItem = {
  productName: string
  color: string
  size: string
  quantity: number
  unitPrice: number
}

export type OrderConfirmationEmail = {
  orderNumber: string
  email: string
  recipientName?: string
  items: OrderConfirmationItem[]
  subtotal: number
  shippingFee: number
  total: number
  storeChain?: 'seven_eleven' | 'family_mart'
  storeName?: string
  storeId?: string
  paymentMethod?: 'bank_transfer' | 'convenience_cod' | 'online_test'
}

const CHAIN_LABEL: Record<string, string> = {
  seven_eleven: '7-ELEVEN',
  family_mart: '全家',
}

const PAYMENT_LABEL: Record<string, string> = {
  bank_transfer: '銀行匯款',
  convenience_cod: '超商取貨付款',
  online_test: '線上付款',
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderOrderConfirmationEmail(order: OrderConfirmationEmail): { subject: string; html: string } {
  const lookupUrl = absoluteUrl('/order-lookup')
  const isBankTransfer = order.paymentMethod === 'bank_transfer'
  const bank = isBankTransfer ? getBankTransferInfo() : null

  const rows = order.items.map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #dde5ea;color:#4c4c4c;">
        ${escapeHtml(item.productName)}<br>
        <span style="color:#8b8b8b;font-size:13px;">${escapeHtml(item.color)}／尺寸 ${escapeHtml(item.size)}　×${item.quantity}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #dde5ea;text-align:right;color:#4c4c4c;white-space:nowrap;">
        ${escapeHtml(formatTwd(item.unitPrice * item.quantity))}
      </td>
    </tr>`).join('')

  const bankBlock = bank ? `
    <div style="margin-top:24px;padding:18px 20px;background:#eef3f5;border-radius:8px;">
      <p style="margin:0 0 10px;font-weight:700;color:#52667a;">匯款資訊</p>
      <p style="margin:4px 0;color:#4c4c4c;">銀行：${escapeHtml(bank.bankName)}（${escapeHtml(bank.bankCode)}）</p>
      <p style="margin:4px 0;color:#4c4c4c;">帳號：${escapeHtml(bank.accountNumber)}</p>
      <p style="margin:4px 0;color:#4c4c4c;">戶名：${escapeHtml(bank.accountName)}</p>
      <p style="margin:4px 0;color:#4c4c4c;">金額：${escapeHtml(formatTwd(order.total))}</p>
      <p style="margin:12px 0 0;color:#8b8b8b;font-size:13px;">完成匯款後，請至下方「查詢訂單」頁面回報帳號末 5 碼，方便我們核對。</p>
    </div>` : ''

  const codBlock = order.paymentMethod === 'convenience_cod' ? `
    <p style="margin:20px 0 0;color:#4c4c4c;">付款方式為<strong>超商取貨付款</strong>，商品抵達門市後，取貨時再付款即可。</p>` : ''

  const storeLine = order.storeName
    ? `${CHAIN_LABEL[order.storeChain ?? ''] ?? '超商'}／${escapeHtml(order.storeName)}${order.storeId ? `（店號 ${escapeHtml(order.storeId)}）` : ''}`
    : '—'

  const subject = `【MORIMUR BABY】訂單成立通知 ${order.orderNumber}`

  const html = `
  <div style="margin:0;padding:24px;background:#f0f4f6;font-family:'Helvetica Neue',Arial,'PingFang TC','Microsoft JhengHei',sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <div style="padding:28px 32px;background:#6a7f90;color:#ffffff;">
        <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#cdd9e2;">MORIMUR BABY</p>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:500;">訂單已成立，謝謝你的訂購！</h1>
      </div>
      <div style="padding:28px 32px;">
        <p style="margin:0 0 4px;color:#8b8b8b;font-size:13px;">訂單編號（請保留此編號以便查詢）</p>
        <p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#52667a;letter-spacing:0.04em;">${escapeHtml(order.orderNumber)}</p>

        <table style="width:100%;border-collapse:collapse;">
          <tbody>${rows}</tbody>
          <tfoot>
            <tr><td style="padding:10px 0 2px;color:#8b8b8b;">商品小計</td><td style="padding:10px 0 2px;text-align:right;color:#4c4c4c;">${escapeHtml(formatTwd(order.subtotal))}</td></tr>
            <tr><td style="padding:2px 0;color:#8b8b8b;">運費</td><td style="padding:2px 0;text-align:right;color:#4c4c4c;">${order.shippingFee === 0 ? '免運' : escapeHtml(formatTwd(order.shippingFee))}</td></tr>
            <tr><td style="padding:8px 0 0;font-weight:700;color:#52667a;">合計</td><td style="padding:8px 0 0;text-align:right;font-weight:700;color:#52667a;">${escapeHtml(formatTwd(order.total))}</td></tr>
          </tfoot>
        </table>

        <div style="margin-top:22px;padding-top:18px;border-top:1px solid #dde5ea;">
          <p style="margin:4px 0;color:#4c4c4c;"><span style="color:#8b8b8b;">取貨門市：</span>${storeLine}</p>
          <p style="margin:4px 0;color:#4c4c4c;"><span style="color:#8b8b8b;">付款方式：</span>${PAYMENT_LABEL[order.paymentMethod ?? ''] ?? '—'}</p>
        </div>
        ${bankBlock}
        ${codBlock}

        <div style="margin-top:28px;text-align:center;">
          <a href="${lookupUrl}" style="display:inline-block;padding:12px 26px;background:#6a7f90;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700;">查詢訂單進度</a>
        </div>
        <p style="margin:18px 0 0;color:#8b8b8b;font-size:13px;text-align:center;">
          忘記訂單編號時，可用此 Email（${escapeHtml(order.email)}）與訂單編號到查詢頁查看。
        </p>
      </div>
    </div>
    <p style="max-width:560px;margin:16px auto 0;color:#b0aca4;font-size:12px;text-align:center;">此信件由系統自動發送，請勿直接回覆。</p>
  </div>`

  return { subject, html }
}

export async function sendOrderConfirmationEmail(order: OrderConfirmationEmail): Promise<SendEmailResult> {
  const { subject, html } = renderOrderConfirmationEmail(order)
  return sendEmail({ to: order.email, subject, html })
}
