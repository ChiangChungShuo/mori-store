import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isE2EMode } from '@/testing/e2e-mode'

// Storefront analytics are written by anonymous visitors, so this endpoint can
// never be fully trusted. Two limits keep a flood of forged events from
// distorting the owner's reports: a per-IP budget, and a search term short and
// plain enough that it cannot be used to plant text on the storefront.
const WINDOW_MS = 60_000
const MAX_EVENTS_PER_WINDOW = 60
const buckets = new Map<string, { count: number; resetAt: number }>()

function overRateLimit(key: string) {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    // Opportunistic cleanup so the map cannot grow without bound.
    if (buckets.size > 5_000) {
      for (const [entryKey, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(entryKey)
      }
    }
    return false
  }
  bucket.count += 1
  return bucket.count > MAX_EVENTS_PER_WINDOW
}

const eventSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.enum(['page_view', 'product_view', 'add_to_cart', 'checkout_started', 'purchase', 'search']),
  productName: z.string().trim().max(160).nullable(),
  searchQuery: z.string()
    .trim()
    .max(24)
    // The zero-result page shows these terms back to shoppers, so anything that
    // is not a plain search word is dropped at the door.
    .refine((value) => !/[\u0000-\u001f\u007f<>]/.test(value), '包含不允許的字元')
    .refine((value) => !/(https?:|www\.|\/\/)/i.test(value), '搜尋關鍵字不能是連結')
    .nullable()
    .default(null),
  resultCount: z.number().int().min(0).max(10000).nullable().default(null),
  path: z.string().trim().startsWith('/').max(500),
})

export async function POST(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',', 1)[0].trim()
  const clientKey = forwardedFor || request.headers.get('x-real-ip') || 'unknown'
  if (overRateLimit(clientKey)) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }

  const parsed = eventSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 })

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    getE2EStore().events.push({ ...parsed.data, createdAt: new Date().toISOString() })
  } else {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { error } = await createAdminClient().from('storefront_events').insert({
      session_id: parsed.data.sessionId,
      event_type: parsed.data.type,
      product_name: parsed.data.productName,
      search_query: parsed.data.searchQuery,
      search_result_count: parsed.data.resultCount,
      path: parsed.data.path,
    })
    if (error) throw error
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
