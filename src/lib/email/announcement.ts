import 'server-only'

import { absoluteUrl } from '@/lib/site'
import { sendEmail, type SendEmailResult } from '@/lib/email/resend'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderAnnouncementEmail(subject: string, body: string): { subject: string; html: string } {
  const shopUrl = absoluteUrl('/')
  const paragraphs = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 14px;color:#4c4c4c;font-size:15px;line-height:1.8;">${escapeHtml(line)}</p>`)
    .join('')

  const html = `
  <div style="margin:0;padding:24px;background:#f0f4f6;font-family:'Helvetica Neue',Arial,'PingFang TC','Microsoft JhengHei',sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <div style="padding:26px 32px;background:#6a7f90;color:#ffffff;">
        <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#cdd9e2;">MORIMUR BABY</p>
        <h1 style="margin:6px 0 0;font-size:20px;font-weight:500;">${escapeHtml(subject)}</h1>
      </div>
      <div style="padding:26px 32px;">
        ${paragraphs}
        <div style="margin-top:24px;text-align:center;">
          <a href="${shopUrl}" style="display:inline-block;padding:12px 26px;background:#5a6b7b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700;">前往商店逛逛</a>
        </div>
      </div>
    </div>
    <p style="max-width:560px;margin:16px auto 0;color:#b0aca4;font-size:12px;text-align:center;line-height:1.6;">
      你會收到這封信，是因為你在 MORIMUR BABY 註冊時同意接收新品與優惠消息。<br>若不想再收到，請回信告知即可。
    </p>
  </div>`

  return { subject, html }
}

export async function sendAnnouncementEmail(to: string, subject: string, body: string): Promise<SendEmailResult> {
  const { html } = renderAnnouncementEmail(subject, body)
  return sendEmail({ to, subject, html })
}
