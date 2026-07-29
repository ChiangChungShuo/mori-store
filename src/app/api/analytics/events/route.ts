import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isE2EMode } from '@/testing/e2e-mode'

const eventSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.enum(['page_view', 'product_view', 'add_to_cart', 'checkout_started', 'purchase', 'search']),
  productName: z.string().trim().max(160).nullable(),
  searchQuery: z.string().trim().max(120).nullable().default(null),
  resultCount: z.number().int().min(0).max(10000).nullable().default(null),
  path: z.string().trim().startsWith('/').max(500),
})

export async function POST(request: Request) {
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
