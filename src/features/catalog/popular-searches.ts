import { isE2EMode } from '@/testing/e2e-mode'

/**
 * Search terms other shoppers used successfully, for the zero-result page.
 *
 * Only terms that actually returned products are offered — suggesting a term
 * that also finds nothing would waste the one chance to recover the visit.
 * Runs only when a search comes back empty, so the catalog's happy path keeps
 * its current query count.
 */
const LOOKBACK_DAYS = 60
const MAX_TERMS = 6

function rank(rows: Array<{ query: string; results: number }>) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const term = row.query.trim()
    if (!term || term.length > 20 || row.results <= 0) continue
    counts.set(term, (counts.get(term) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-Hant'))
    .slice(0, MAX_TERMS)
    .map(([term]) => term)
}

/**
 * Anyone can post analytics events, so a term is only shown once it still finds
 * something in the live catalog. Injected junk matches no product and never
 * reaches a shopper's screen.
 */
async function keepTermsThatStillFindProducts(terms: string[]): Promise<string[]> {
  if (terms.length === 0) return []
  const { applyCatalogFilters, listProducts } = await import('@/features/catalog/queries')
  const catalog = await listProducts({})
  return terms.filter((term) => applyCatalogFilters(catalog, { q: term }).length > 0)
}

export async function listPopularSearchTerms(): Promise<string[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString()

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    return keepTermsThatStillFindProducts(rank(getE2EStore().events
      .filter((event) => event.type === 'search' && event.createdAt >= since)
      .map((event) => ({ query: event.searchQuery ?? '', results: event.resultCount ?? 0 }))))
  }

  try {
    // Service-role read: the rows are anonymous counters, and only the term
    // strings leave this function.
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data, error } = await createAdminClient()
      .from('storefront_events')
      .select('search_query, search_result_count')
      .eq('event_type', 'search')
      .gte('created_at', since)
      .not('search_query', 'is', null)
      .limit(500)
    if (error || !data) return []
    return keepTermsThatStillFindProducts(rank(data.map((row) => ({
      query: String(row.search_query ?? ''),
      results: Number(row.search_result_count ?? 0),
    }))))
  } catch {
    // Analytics must never break the catalog.
    return []
  }
}
