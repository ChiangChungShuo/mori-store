import { requireAdmin } from '@/lib/auth/require-admin'
import { isE2EMode } from '@/testing/e2e-mode'

export type BroadcastState = { ok: boolean; message: string }

const MAX_RECIPIENTS = 500

// Emails of members who opted in to marketing at signup.
async function listSubscriberEmails(): Promise<string[]> {
  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    return [...getE2EStore().users.values()]
      .filter((user) => user.marketingConsentAt && user.email)
      .map((user) => user.email)
  }
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { data, error } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users
    .filter((user) => user.email && (user.user_metadata as { marketing_consent_at?: unknown } | null)?.marketing_consent_at)
    .map((user) => user.email as string)
}

export async function countMarketingSubscribers(): Promise<number> {
  await requireAdmin()
  try {
    return (await listSubscriberEmails()).length
  } catch {
    return 0
  }
}

export async function sendMarketingBroadcastFromForm(
  _previousState: BroadcastState,
  formData: FormData,
): Promise<BroadcastState> {
  'use server'
  await requireAdmin()
  const subject = String(formData.get('subject') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  if (!subject) return { ok: false, message: '請填寫主旨' }
  if (!body) return { ok: false, message: '請填寫內容' }

  if (isE2EMode()) {
    const emails = await listSubscriberEmails()
    return { ok: true, message: `已寄送給 ${emails.length} 位訂閱會員（本機測試不會實際寄出）` }
  }

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, message: '尚未設定寄信服務（RESEND_API_KEY），無法群發' }
  }

  let emails: string[]
  try {
    emails = await listSubscriberEmails()
  } catch {
    return { ok: false, message: '目前無法讀取訂閱名單，請稍後再試' }
  }
  if (emails.length === 0) return { ok: false, message: '目前沒有訂閱行銷消息的會員' }

  const recipients = emails.slice(0, MAX_RECIPIENTS)
  const { sendAnnouncementEmail } = await import('@/lib/email/announcement')
  let sent = 0
  let failed = 0
  for (const email of recipients) {
    const result = await sendAnnouncementEmail(email, subject, body)
    if (result.status === 'sent') sent += 1
    else failed += 1
  }

  const capped = emails.length > MAX_RECIPIENTS ? `（本次上限 ${MAX_RECIPIENTS} 位）` : ''
  const failedNote = failed > 0 ? `，${failed} 封寄送失敗` : ''
  return { ok: sent > 0, message: `已寄送給 ${sent} 位訂閱會員${failedNote}${capped}` }
}
