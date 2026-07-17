export type DashboardMetrics = {
  todayOrders: number
  fulfillmentBacklog: number
  lowStockVariants: number
}

export interface DashboardRepository {
  countOrdersCreatedBetween(startedAt: string, endedAt: string): Promise<number>
  countFulfillmentBacklog(statuses: readonly ['paid', 'preparing']): Promise<number>
  countLowStockVariants(maximumStock: number): Promise<number>
}

const TAIPEI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const taipeiCalendarFormatter = new Intl.DateTimeFormat('en', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Taipei',
  year: 'numeric',
})

export function taipeiDayRange(now: Date) {
  const parts = Object.fromEntries(
    taipeiCalendarFormatter.formatToParts(now).map((part) => [part.type, part.value]),
  )
  const startMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  ) - TAIPEI_UTC_OFFSET_MS
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + DAY_MS).toISOString(),
  }
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
      const range = taipeiDayRange(dependencies.now?.() ?? new Date())
      const [todayOrders, fulfillmentBacklog, lowStockVariants] = await Promise.all([
        dependencies.repository.countOrdersCreatedBetween(range.start, range.end),
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
    async countOrdersCreatedBetween(startedAt, endedAt) {
      const { createClient } = await import('@/lib/supabase/server')
      return count(await (await createClient())
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startedAt)
        .lt('created_at', endedAt))
    },
    async countFulfillmentBacklog(statuses) {
      const { createClient } = await import('@/lib/supabase/server')
      return count(await (await createClient())
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', statuses))
    },
    async countLowStockVariants(maximumStock) {
      const { createClient } = await import('@/lib/supabase/server')
      return count(await (await createClient())
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
