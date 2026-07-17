export type DashboardMetrics = {
  todayOrders: number
  fulfillmentBacklog: number
  lowStockVariants: number
}

export interface DashboardRepository {
  countOrdersCreatedSince(startedAt: string): Promise<number>
  countFulfillmentBacklog(statuses: readonly ['paid', 'preparing']): Promise<number>
  countLowStockVariants(maximumStock: number): Promise<number>
}

type DashboardDependencies = {
  repository: DashboardRepository
  requireAdmin: () => Promise<unknown>
  now?: () => Date
}

export function createDashboardQueries(dependencies: DashboardDependencies) {
  return {
    async getDashboardMetrics(): Promise<DashboardMetrics> {
      await dependencies.requireAdmin()
      const start = dependencies.now?.() ?? new Date()
      start.setHours(0, 0, 0, 0)
      const [todayOrders, fulfillmentBacklog, lowStockVariants] = await Promise.all([
        dependencies.repository.countOrdersCreatedSince(start.toISOString()),
        dependencies.repository.countFulfillmentBacklog(['paid', 'preparing']),
        dependencies.repository.countLowStockVariants(3),
      ])
      return { todayOrders, fulfillmentBacklog, lowStockVariants }
    },
  }
}

function count(result: { count: number | null; error: unknown }) {
  if (result.error) throw result.error
  return result.count ?? 0
}

function createSupabaseDashboardRepository(): DashboardRepository {
  return {
    async countOrdersCreatedSince(startedAt) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      return count(await createAdminClient()
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startedAt))
    },
    async countFulfillmentBacklog(statuses) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      return count(await createAdminClient()
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', statuses))
    },
    async countLowStockVariants(maximumStock) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      return count(await createAdminClient()
        .from('product_variants')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .lte('stock', maximumStock))
    },
  }
}

export async function getDashboardMetrics() {
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  return createDashboardQueries({
    repository: createSupabaseDashboardRepository(),
    requireAdmin,
  }).getDashboardMetrics()
}
