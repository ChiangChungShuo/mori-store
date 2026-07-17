import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createAdminOrderActions,
  createAdminOrderQueries,
  type AdminOrderRepository,
  type AdminOrderQueryRepository,
} from '@/features/admin/order-actions'
import {
  createAdminSettingsActions,
  settingsSchema,
  type StoreSettingsRepository,
} from '@/features/admin/settings-actions'
import type { OrderStatus } from '@/types/store'
import { calculateCart } from '@/features/cart/totals'
import {
  createDashboardQueries,
  type DashboardRepository,
} from '@/features/admin/dashboard-queries'

const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

class MemoryOrderRepository implements AdminOrderRepository {
  readonly events: string[] = []
  status: OrderStatus = 'paid'
  updatedAt: string | null = null

  async getOrderStatus(id: string) {
    this.events.push(`load:${id}`)
    return id === orderId ? this.status : null
  }

  async transitionOrder(
    id: string,
    expectedStatus: OrderStatus,
    nextStatus: OrderStatus,
    updatedAt: string,
  ) {
    this.events.push(`transition:${id}:${expectedStatus}:${nextStatus}`)
    if (this.status !== expectedStatus) throw new Error('order_status_changed')
    this.status = nextStatus
    this.updatedAt = updatedAt
  }
}

class MemoryStoreSettingsRepository implements StoreSettingsRepository {
  readonly events: string[] = []
  saved: Parameters<StoreSettingsRepository['updateSettings']>[0] | null = null

  async updateSettings(settings: Parameters<StoreSettingsRepository['updateSettings']>[0]) {
    this.events.push('update-settings')
    this.saved = settings
  }
}

describe('admin order actions', () => {
  it('does not move collected orders back to preparing', async () => {
    const repository = new MemoryOrderRepository()
    repository.status = 'collected'
    const actions = createAdminOrderActions({
      repository,
      requireAdmin: async () => repository.events.push('admin'),
    })

    await expect(actions.updateOrderStatus(orderId, 'preparing'))
      .rejects.toThrow('無法變更為此狀態')
    expect(repository.events).toEqual(['admin', `load:${orderId}`])
    expect(repository.status).toBe('collected')
  })

  it('reloads the current state and records updated_at during an allowed transition', async () => {
    const repository = new MemoryOrderRepository()
    const now = '2026-07-17T08:00:00.000Z'
    const actions = createAdminOrderActions({
      repository,
      requireAdmin: async () => repository.events.push('admin'),
      now: () => new Date(now),
    })

    await actions.updateOrderStatus(orderId, 'preparing')

    expect(repository.events).toEqual([
      'admin',
      `load:${orderId}`,
      `transition:${orderId}:paid:preparing`,
    ])
    expect(repository.status).toBe('preparing')
    expect(repository.updatedAt).toBe(now)
  })

  it('does not overwrite a concurrent status change', async () => {
    const repository = new MemoryOrderRepository()
    const originalLoad = repository.getOrderStatus.bind(repository)
    repository.getOrderStatus = async (id) => {
      const current = await originalLoad(id)
      repository.status = 'cancelled'
      return current
    }
    const actions = createAdminOrderActions({
      repository,
      requireAdmin: async () => repository.events.push('admin'),
    })

    await expect(actions.updateOrderStatus(orderId, 'preparing'))
      .rejects.toThrow('訂單狀態已變更')
    expect(repository.status).toBe('cancelled')
  })
})

describe('admin order queries', () => {
  it('authorizes before applying number, recipient, email and status filters', async () => {
    const events: string[] = []
    const repository: AdminOrderQueryRepository = {
      async listOrders(filters) {
        events.push(`list:${filters.query}:${filters.status}`)
        return []
      },
      async getOrder() {
        return null
      },
    }
    const queries = createAdminOrderQueries({
      repository,
      requireAdmin: async () => events.push('admin'),
    })

    await queries.listAdminOrders({ query: ' MORI / 小美 / user@test ', status: 'paid' })

    expect(events).toEqual(['admin', 'list:MORI / 小美 / user@test:paid'])
  })
})

describe('admin store settings', () => {
  it('rejects negative shipping fees', () => {
    expect(settingsSchema.safeParse({
      shippingFee: -1,
      freeShippingThreshold: 1500,
      contactEmail: 'hello@mori.test',
    }).success).toBe(false)
  })

  it('does not turn a blank shipping fee into zero', () => {
    expect(settingsSchema.safeParse({
      shippingFee: '',
      freeShippingThreshold: 1500,
      contactEmail: 'hello@mori.test',
    }).success).toBe(false)
  })

  it('treats a blank free-shipping threshold as disabled', () => {
    expect(settingsSchema.parse({
      shippingFee: '60',
      freeShippingThreshold: '',
      contactEmail: ' HELLO@MORI.TEST ',
    })).toEqual({
      shippingFee: 60,
      freeShippingThreshold: null,
      contactEmail: 'hello@mori.test',
    })
  })

  it('charges shipping when the free-shipping threshold is disabled', () => {
    expect(calculateCart([{ unitPrice: 2000, quantity: 1 }], 60, null)).toEqual({
      subtotal: 2000,
      shipping: 60,
      total: 2060,
    })
  })

  it('authorizes before validating and saving settings', async () => {
    const repository = new MemoryStoreSettingsRepository()
    const actions = createAdminSettingsActions({
      repository,
      requireAdmin: async () => repository.events.push('admin'),
    })

    await actions.updateStoreSettings({
      shippingFee: 80,
      freeShippingThreshold: null,
      contactEmail: 'orders@mori.test',
    })

    expect(repository.events).toEqual(['admin', 'update-settings'])
    expect(repository.saved).toEqual({
      shippingFee: 80,
      freeShippingThreshold: null,
      contactEmail: 'orders@mori.test',
    })
  })
})

describe('admin order database contract', () => {
  it('locks and validates the expected status in the atomic transition RPC', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/202607170006_order_admin.sql'),
      'utf8',
    )
    const actions = readFileSync(
      resolve(process.cwd(), 'src/features/admin/order-actions.ts'),
      'utf8',
    )

    expect(migration).toMatch(/admin_update_order_status/)
    expect(migration).toMatch(/for update/i)
    expect(migration).toMatch(/order_status_changed/)
    expect(migration).toMatch(/updated_at\s*=\s*p_updated_at/i)
    expect(migration).toMatch(/public\.is_admin\(\)/)
    expect(actions).toMatch(/\.rpc\(['"]admin_update_order_status['"]/)
  })
})

describe('admin dashboard queries', () => {
  it('counts today, paid and preparing backlog, and active stock at most three', async () => {
    const events: string[] = []
    const repository: DashboardRepository = {
      async countOrdersCreatedSince() {
        events.push('today')
        return 4
      },
      async countFulfillmentBacklog(statuses) {
        events.push(statuses.join('+'))
        return 5
      },
      async countLowStockVariants(maximumStock) {
        events.push(`active-stock<=${maximumStock}`)
        return 5
      },
    }
    const queries = createDashboardQueries({
      repository,
      requireAdmin: async () => events.push('admin'),
      now: () => new Date('2026-07-17T08:00:00.000Z'),
    })

    await expect(queries.getDashboardMetrics()).resolves.toEqual({
      todayOrders: 4,
      fulfillmentBacklog: 5,
      lowStockVariants: 5,
    })
    expect(events).toEqual([
      'admin',
      'today',
      'paid+preparing',
      'active-stock<=3',
    ])
  })
})

describe('admin fulfillment pages', () => {
  it('shows searchable orders, immutable fulfillment details and three dashboard metrics', () => {
    const ordersPage = readFileSync(resolve(process.cwd(), 'src/app/admin/orders/page.tsx'), 'utf8')
    const detailPage = readFileSync(
      resolve(process.cwd(), 'src/app/admin/orders/[orderNumber]/page.tsx'),
      'utf8',
    )
    const dashboardPage = readFileSync(resolve(process.cwd(), 'src/app/admin/page.tsx'), 'utf8')

    expect(ordersPage).toMatch(/訂單編號、收件人或 Email/)
    expect(ordersPage).toMatch(/status/)
    expect(detailPage).toMatch(/order\.items\.map/)
    expect(detailPage).toMatch(/測試付款/)
    expect(detailPage).toMatch(/取貨門市/)
    expect(detailPage).toMatch(/收件人/)
    expect(dashboardPage).toMatch(/todayOrders/)
    expect(dashboardPage).toMatch(/fulfillmentBacklog/)
    expect(dashboardPage).toMatch(/lowStockVariants/)
  })
})
