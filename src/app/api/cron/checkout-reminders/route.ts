import { parseCartReminderSettings } from '@/features/admin/business-management'
import { sendCheckoutReminderEmail } from '@/lib/email/checkout-reminder'
import type { PaymentAttemptItem } from '@/features/checkout/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Daily Vercel cron (09:00 Taipei; Hobby plans allow at most one run per day).
// Two jobs share the run because of that one-cron limit:
//   1. mail shoppers whose bank-transfer checkout has sat in `pending` longer
//      than the configured delay — once per attempt, and only for attempts
//      younger than 7 days so a backlog never spams old carts;
//   2. mail everyone waiting on a 到貨通知 whose product is back in stock.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) {
    return Response.json({ skipped: 'RESEND_API_KEY not configured' })
  }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  // Restock notices run first: they are the shortest job and independent of the
  // reminder settings below.
  const { notifyRestockedProducts } = await import('@/features/catalog/restock-notifier')
  const restock = await notifyRestockedProducts(admin).catch(() => ({ sent: 0, waiting: 0 }))

  const { data: settingsRow } = await admin
    .from('store_settings')
    .select('value')
    .eq('key', 'cart_reminder')
    .maybeSingle()
  const settings = parseCartReminderSettings(settingsRow?.value)
  if (!settings.enabled) return Response.json({ restock, skipped: 'reminders disabled' })

  const cutoff = new Date(Date.now() - settings.delayHours * 3600 * 1000).toISOString()
  const oldest = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const { data: attempts, error } = await admin
    .from('payment_attempts')
    .select('id, email, recipient_name, items, total')
    .eq('status', 'pending')
    .is('reminder_sent_at', null)
    .lt('created_at', cutoff)
    .gte('created_at', oldest)
    .order('created_at')
    .limit(20)
  if (error) return Response.json({ restock, error: error.message }, { status: 500 })

  let sent = 0
  const failures: string[] = []
  for (const attempt of attempts ?? []) {
    if (!attempt.email || !Array.isArray(attempt.items)) continue

    // Claim the row before sending so overlapping cron runs never double-mail.
    const { data: claimed } = await admin
      .from('payment_attempts')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', attempt.id)
      .is('reminder_sent_at', null)
      .select('id')
    if (!claimed?.length) continue

    const items = (attempt.items as unknown as PaymentAttemptItem[]).map((item) => ({
      productName: item.product_name,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    }))
    const result = await sendCheckoutReminderEmail({
      email: attempt.email,
      recipientName: attempt.recipient_name ?? undefined,
      subject: settings.subject,
      items,
      total: attempt.total,
    })
    if (result.status === 'sent') {
      sent += 1
    } else {
      failures.push(attempt.id)
      // Release the claim so the next run retries this attempt.
      await admin
        .from('payment_attempts')
        .update({ reminder_sent_at: null })
        .eq('id', attempt.id)
    }
  }

  return Response.json({ restock, sent, failed: failures.length, scanned: attempts?.length ?? 0 })
}
