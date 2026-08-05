import { isE2EMode } from '@/testing/e2e-mode'

export type RestockRequestState = { status: 'idle' | 'ok' | 'error'; message: string }

/** Products with people waiting, for the admin restock panel. */
export type PendingRestock = { productId: string; count: number }

/** Counts of people waiting per product, newest requests first. */
export async function listPendingRestockCounts(): Promise<PendingRestock[]> {
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const counts = new Map<string, number>()
    for (const request of getE2EStore().restockRequests) {
      if (request.notifiedAt) continue
      counts.set(request.productId, (counts.get(request.productId) ?? 0) + 1)
    }
    return [...counts.entries()].map(([productId, count]) => ({ productId, count }))
  }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { data, error } = await createAdminClient()
    .from('restock_requests')
    .select('product_id')
    .is('notified_at', null)
  if (error || !data) return []

  const counts = new Map<string, number>()
  for (const row of data) {
    const productId = String(row.product_id)
    counts.set(productId, (counts.get(productId) ?? 0) + 1)
  }
  return [...counts.entries()].map(([productId, count]) => ({ productId, count }))
}
