import 'server-only'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

// Resend's shared sender works without a verified domain, but only delivers to
// the account owner's own address until a domain is verified. Once the shop
// verifies a domain in Resend, set MORI_EMAIL_FROM to an address on it.
const DEFAULT_FROM = 'MORIMUR BABY <onboarding@resend.dev>'

export type SendEmailInput = {
  to: string
  subject: string
  html: string
  replyTo?: string
}

export type SendEmailResult =
  | { status: 'sent'; id: string }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; message: string }

/**
 * Sends a transactional email through Resend. Designed to never throw so that
 * a mail failure can never roll back an order that already succeeded. When
 * RESEND_API_KEY is not configured the call is a silent no-op, so local and
 * preview environments keep working without any mail provider.
 */
export async function sendEmail({ to, subject, html, replyTo }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return { status: 'skipped', reason: 'RESEND_API_KEY not configured' }

  const from = process.env.MORI_EMAIL_FROM?.trim() || DEFAULT_FROM
  const bcc = process.env.MORI_ORDER_BCC?.trim()

  const payload: Record<string, unknown> = { from, to: [to], subject, html }
  if (replyTo) payload.reply_to = [replyTo]
  if (bcc) payload.bcc = [bcc]

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error(`[email] Resend responded ${response.status}: ${detail.slice(0, 500)}`)
      return { status: 'error', message: `Resend ${response.status}` }
    }
    const data = (await response.json().catch(() => ({}))) as { id?: string }
    return { status: 'sent', id: data.id ?? '' }
  } catch (error) {
    console.error('[email] Resend request failed', error)
    return { status: 'error', message: error instanceof Error ? error.message : 'unknown error' }
  }
}
