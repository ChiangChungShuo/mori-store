import { isE2EMode } from '@/testing/e2e-mode'

/**
 * Per-product view counts for the admin.
 *
 * Rows are matched by the slug in the event path rather than by the product
 * name: names get edited, the URL does not, so a rename keeps its history.
 * Sessions are counted alongside views because one shopper opening a product
 * five times is not five people.
 */
export type ProductViewCount = {
  slug: string
  views: number
  sessions: number
}

const MAX_EVENTS = 5_000

function slugFromPath(path: string) {
  const match = /^\/products\/([^/?#]+)/.exec(path)
  return match ? decodeURIComponent(match[1]) : null
}

function tally(rows: Array<{ path: string; sessionId: string }>): ProductViewCount[] {
  const counts = new Map<string, { views: number; sessions: Set<string> }>()
  for (const row of rows) {
    const slug = slugFromPath(row.path)
    if (!slug) continue
    const entry = counts.get(slug) ?? { views: 0, sessions: new Set<string>() }
    entry.views += 1
    entry.sessions.add(row.sessionId)
    counts.set(slug, entry)
  }
  return [...counts.entries()]
    .map(([slug, entry]) => ({ slug, views: entry.views, sessions: entry.sessions.size }))
    .sort((left, right) => right.views - left.views)
}

export async function listProductViewCounts(days = 30): Promise<ProductViewCount[]> {
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()

  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    return tally(getE2EStore().events
      .filter((event) => event.type === 'product_view' && (event.createdAt ?? '') >= since)
      .map((event) => ({ path: event.path, sessionId: event.sessionId })))
  }

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data, error } = await createAdminClient()
      .from('storefront_events')
      .select('path, session_id')
      .eq('event_type', 'product_view')
      .gte('created_at', since)
      .limit(MAX_EVENTS)
    if (error || !data) return []
    return tally(data.map((row) => ({ path: String(row.path ?? ''), sessionId: String(row.session_id ?? '') })))
  } catch {
    // Analytics must never break the product list.
    return []
  }
}
