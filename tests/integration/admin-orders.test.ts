import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createAdminOrderActions,
  createAdminOrderQueries,
  getAdminOrder,
  listAdminOrders,
  type AdminOrderRepository,
  type AdminOrderQueryRepository,
  updateOrderStatus,
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
  getDashboardMetrics,
  taipeiDayRange,
  type DashboardRepository,
} from '@/features/admin/dashboard-queries'
import { createE2EStore, getE2EStore } from '@/testing/e2e-store'
import { renderOrderShippedEmail } from '@/lib/email/order-shipped'

const adminGate = vi.hoisted(() => ({ requireAdmin: vi.fn(async () => undefined) }))
const liveSupabase = vi.hoisted(() => ({ createClient: vi.fn() }))
const nextCache = vi.hoisted(() => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth/require-admin', () => adminGate)
vi.mock('@/lib/supabase/server', () => liveSupabase)
vi.mock('next/cache', () => nextCache)

const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  adminGate.requireAdmin.mockResolvedValue(undefined)
})

function useFreshFixtureStore() {
  const source = createE2EStore()
  const store = getE2EStore()
  store.users = source.users
  store.sessions = source.sessions
  store.attempts = source.attempts
  store.orders = source.orders
  store.events = source.events
  store.settings = source.settings
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('MORI_E2E_FIXTURES', '1')
  return store
}

class MemoryOrderRepository implements AdminOrderRepository {
  readonly events: string[] = []
  status: OrderStatus = 'paid'
  updatedAt: string | null = null
  merchantReply = ''

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

  async saveMerchantReply(id: string, reply: string) {
    this.events.push(`reply:${id}:${reply}`)
    this.merchantReply = reply
  }

  trackingCode: string | null = null

  async saveTrackingCode(id: string, trackingCode: string) {
    this.events.push(`tracking:${id}:${trackingCode}`)
    this.trackingCode = trackingCode || null
  }
}

class MemoryStoreSettingsRepository implements StoreSettingsRepository {
  readonly events: string[] = []
  saved: Parameters<StoreSettingsRepository['updateSettings']>[0] | null = null

  async getSettings() {
    return {
      shippingFee: 60,
      freeShippingThreshold: 1500,
      contactEmail: 'hello@mori.test',
    }
  }

  async updateSettings(settings: Parameters<StoreSettingsRepository['updateSettings']>[0]) {
    this.events.push('update-settings')
    this.saved = settings
  }
}

describe('admin order actions', () => {
  it('lets the owner save a reply that customers can read with the order', async () => {
    const repository = new MemoryOrderRepository()
    const actions = createAdminOrderActions({
      repository,
      requireAdmin: async () => repository.events.push('admin'),
    })

    await expect(actions.replyToCustomer(orderId, '尺寸已確認，會依訂單內容出貨。'))
      .resolves.toMatchObject({ ok: true })
    expect(repository.merchantReply).toBe('尺寸已確認，會依訂單內容出貨。')
    expect(repository.events).toEqual(['admin', `reply:${orderId}:尺寸已確認，會依訂單內容出貨。`])
  })

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
      async listOrderExports(filters) {
        events.push(`export:${filters.query}:${filters.status}`)
        return []
      },
      async getOrder() {
        return null
      },
      async listPaymentAttemptsRequiringReview() {
        events.push('list-review')
        return []
      },
      async getPaymentAttemptForReview(attemptId) {
        events.push(`review:${attemptId}`)
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

  it('authorizes review list and detail reads for requires_review attempts', async () => {
    const events: string[] = []
    const repository: AdminOrderQueryRepository = {
      async listOrders() { return [] },
      async listOrderExports() { return [] },
      async getOrder() { return null },
      async listPaymentAttemptsRequiringReview() {
        events.push('list-review')
        return []
      },
      async getPaymentAttemptForReview(attemptId) {
        events.push(`review:${attemptId}`)
        return null
      },
    }
    const queries = createAdminOrderQueries({
      repository,
      requireAdmin: async () => events.push('admin'),
    })

    await queries.listAdminPaymentReviews()
    await queries.getAdminPaymentReview(orderId)

    expect(events).toEqual([
      'admin',
      'list-review',
      'admin',
      `review:${orderId}`,
    ])
  })
})

describe('fixture admin order resolvers', () => {
  it('filters seeded orders and returns their full owner detail', async () => {
    useFreshFixtureStore()

    await expect(listAdminOrders({ query: '王小美', status: 'paid' })).resolves.toEqual([
      expect.objectContaining({ orderNumber: 'MORI-DEMO-1001', recipientName: '王小美' }),
    ])
    await expect(getAdminOrder('MORI-DEMO-1001')).resolves.toEqual(expect.objectContaining({
      recipientName: '王小美',
      storeChain: 'seven_eleven',
      items: expect.arrayContaining([expect.objectContaining({ quantity: 1 })]),
    }))
    expect(adminGate.requireAdmin).toHaveBeenCalledTimes(2)
    expect(liveSupabase.createClient).not.toHaveBeenCalled()
  })

  it('updates a seeded order through the valid fulfillment sequence', async () => {
    const store = useFreshFixtureStore()
    const order = store.orders.get('MORI-DEMO-1001')!

    await updateOrderStatus(order.id, 'preparing')

    await expect(getAdminOrder(order.orderNumber)).resolves.toEqual(expect.objectContaining({
      status: 'preparing',
    }))
    expect(nextCache.revalidatePath).toHaveBeenCalledWith('/admin')
    expect(liveSupabase.createClient).not.toHaveBeenCalled()
  })

  it('denies an admin read before consulting the fixture repository', async () => {
    useFreshFixtureStore()
    const denied = new Error('owner required')
    adminGate.requireAdmin.mockRejectedValueOnce(denied)

    await expect(listAdminOrders()).rejects.toBe(denied)
    expect(liveSupabase.createClient).not.toHaveBeenCalled()
  })

  it('counts the fixture fulfillment backlog without using Supabase', async () => {
    useFreshFixtureStore()

    await expect(getDashboardMetrics()).resolves.toEqual(expect.objectContaining({
      fulfillmentBacklog: 1,
    }))
    expect(adminGate.requireAdmin).toHaveBeenCalledOnce()
    expect(liveSupabase.createClient).not.toHaveBeenCalled()
  })
})

describe('admin store settings', () => {
  it('accepts editable SEO metadata, five keyword groups and an optional GA4 ID', () => {
    expect(settingsSchema.parse({
      shippingFee: 60,
      freeShippingThreshold: 1500,
      contactEmail: 'hello@mori.tw',
      siteTitle: 'mori 童裝商城｜孩子的日常選衣',
      siteDescription: '為孩子挑選親膚、耐穿並且適合每天活動的日常童裝。',
      siteKeywords: ['童裝', '兒童服飾', '有機棉童裝', '親子選物', '超商取貨'],
      googleAnalyticsId: 'G-PSW1MY7HB4',
    })).toEqual(expect.objectContaining({
      siteTitle: 'mori 童裝商城｜孩子的日常選衣',
      siteKeywords: ['童裝', '兒童服飾', '有機棉童裝', '親子選物', '超商取貨'],
      googleAnalyticsId: 'G-PSW1MY7HB4',
    }))
  })

  it('rejects more than five keyword groups and malformed GA4 IDs', () => {
    const base = {
      shippingFee: 60,
      freeShippingThreshold: 1500,
      contactEmail: 'hello@mori.tw',
      siteTitle: 'mori 童裝商城',
      siteDescription: '為孩子挑選親膚、耐穿並且適合每天活動的日常童裝。',
    }
    expect(settingsSchema.safeParse({ ...base, siteKeywords: ['1', '2', '3', '4', '5', '6'], googleAnalyticsId: null }).success).toBe(false)
    expect(settingsSchema.safeParse({ ...base, siteKeywords: ['童裝'], googleAnalyticsId: 'UA-123' }).success).toBe(false)
  })

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

  it('rejects null shipping fees and malformed contact emails', () => {
    expect(settingsSchema.safeParse({
      shippingFee: null,
      freeShippingThreshold: null,
      contactEmail: 'not-an-email',
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
    expect(calculateCart([{ unitPrice: 2000, quantity: 1 }], 60, null)).toMatchObject({
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

  it('reads and updates shared fixture settings without creating a Supabase client', async () => {
    const store = useFreshFixtureStore()
    const { getStoreSettings, updateStoreSettings } = await import('@/features/admin/settings-actions')
    const { getStorefrontSettings } = await import('@/features/checkout/settings')

    await expect(getStoreSettings()).resolves.toEqual({
      shippingFee: 60,
      freeShippingThreshold: 1500,
      contactEmail: 'hello@mori.tw',
    })
    await updateStoreSettings({
      shippingFee: 80,
      freeShippingThreshold: 1800,
      contactEmail: 'orders@mori.tw',
    })

    expect(store.settings).toEqual({
      shippingFee: 80,
      freeShippingThreshold: 1800,
      contactEmail: 'orders@mori.tw',
    })
    await expect(getStorefrontSettings()).resolves.toEqual({
      shippingFee: 80,
      freeShippingThreshold: 1800,
    })
    expect(liveSupabase.createClient).not.toHaveBeenCalled()
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

  it('rejects invalid store settings at the RPC boundary', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/202607170007_admin_review_fixes.sql'),
      'utf8',
    )

    expect(migration).toMatch(/p_shipping_fee\s+integer/i)
    expect(migration).toMatch(/p_free_shipping_threshold\s+integer/i)
    expect(migration).toMatch(/p_shipping_fee\s+is\s+null/i)
    expect(migration).toMatch(/p_free_shipping_threshold\s+is\s+not\s+null[\s\S]*<\s*0/i)
    expect(migration).toMatch(/p_contact_email[\s\S]*!~\*/i)
  })
})

describe('admin dashboard queries', () => {
  it('uses the exact Asia/Taipei day as a half-open UTC interval', () => {
    expect(taipeiDayRange(new Date('2026-07-17T15:59:59.999Z'))).toEqual({
      start: '2026-07-16T16:00:00.000Z',
      end: '2026-07-17T16:00:00.000Z',
    })
    expect(taipeiDayRange(new Date('2026-07-17T16:00:00.000Z'))).toEqual({
      start: '2026-07-17T16:00:00.000Z',
      end: '2026-07-18T16:00:00.000Z',
    })
  })

  it('counts today, paid and preparing backlog, and active stock at most three', async () => {
    const events: string[] = []
    const repository: DashboardRepository = {
      async countOrdersCreatedBetween(start, end) {
        events.push(`today:${start}:${end}`)
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
      'today:2026-07-16T16:00:00.000Z:2026-07-17T16:00:00.000Z',
      'paid+preparing',
      'active-stock<=3',
    ])
  })
})

describe('admin fulfillment pages', () => {
  it('shows searchable orders, immutable fulfillment details and three dashboard metrics', () => {
    const ordersPage = readFileSync(resolve(process.cwd(), 'src/app/admin/orders/page.tsx'), 'utf8')
    const orderList = readFileSync(resolve(process.cwd(), 'src/features/admin/order-list.tsx'), 'utf8')
    const detailPage = readFileSync(
      resolve(process.cwd(), 'src/app/admin/orders/[orderNumber]/page.tsx'),
      'utf8',
    )
    const dashboardPage = readFileSync(resolve(process.cwd(), 'src/app/admin/page.tsx'), 'utf8')
    const adminLayout = readFileSync(resolve(process.cwd(), 'src/app/admin/layout.tsx'), 'utf8')
    const adminNav = readFileSync(resolve(process.cwd(), 'src/features/admin/admin-nav.tsx'), 'utf8')
    const reviewDetailPage = readFileSync(
      resolve(process.cwd(), 'src/app/admin/orders/review/[attemptId]/page.tsx'),
      'utf8',
    )

    expect(orderList).toMatch(/訂單編號、收件人或 Email/)
    expect(orderList).toMatch(/useActionState/)
    expect(orderList).not.toMatch(/method="get"/)
    expect(ordersPage).not.toMatch(/searchParams|method="get"/)
    expect(ordersPage).toMatch(/AdminOrderList/)
    expect(detailPage).toMatch(/formatTaipeiDateTime/)
    expect(detailPage).toMatch(/formatTaipeiDateTime\(order\.createdAt\)/)
    expect(detailPage).toMatch(/order\.items\.map/)
    expect(detailPage).toMatch(/付款資訊/)
    expect(detailPage).toMatch(/銀行匯款/)
    expect(detailPage).toMatch(/取貨門市/)
    expect(detailPage).toMatch(/收件人/)
    expect(dashboardPage).toMatch(/todayOrders/)
    expect(dashboardPage).toMatch(/fulfillmentBacklog/)
    expect(dashboardPage).toMatch(/lowStockVariants/)
    expect(ordersPage).toMatch(/listAdminPaymentReviews/)
    expect(orderList).toMatch(/需人工處理的付款/)
    expect(orderList).toMatch(/reviewCode/)
    expect(reviewDetailPage).toMatch(/reviewReason/)
    expect(reviewDetailPage).toMatch(/payment\.items\.map/)
    expect(adminLayout).toMatch(/<AdminNav \/>/)
    expect(adminLayout).toMatch(/返回商城/)
    expect(adminNav).toMatch(/商店總覽/)
    expect(adminNav).toMatch(/訂單管理/)
    expect(adminNav).toMatch(/商品與庫存/)
    // The current section has to be visibly marked in the rail.
    expect(adminNav).toMatch(/aria-current=\{active \? 'page' : undefined\}/)
    expect(orderList).toMatch(/admin-table-scroll/)
    expect(orderList).toMatch(/className="status-badge" data-status=/)
    expect(orderList).toMatch(/data-label="訂單編號"/)
    expect(orderList).toMatch(/尚未有訂單，可先從商城送出一筆示範訂單。/)
    expect(detailPage).toMatch(/seven_eleven: '7-ELEVEN'/)
    expect(detailPage).toMatch(/family_mart: '全家'/)
  })

  it('keeps wide admin tables inside their own scroll container', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')

    expect(styles).not.toMatch(/^\.admin-product-table\s*\{[^}]*min-width/m)
    expect(styles).toMatch(/\.admin-table-scroll \.admin-product-table\s*\{[^}]*min-width:\s*42rem/)
  })

  it('uses the session client for every admin read', () => {
    const reads = [
      'src/features/admin/order-actions.ts',
      'src/features/admin/dashboard-queries.ts',
      'src/features/admin/settings-actions.ts',
    ].map((path) => readFileSync(resolve(process.cwd(), path), 'utf8')).join('\n')

    expect(reads).not.toMatch(/createAdminClient/)
    expect(reads).toMatch(/@\/lib\/supabase\/server/)
  })

  it('saves and clears a 物流追蹤碼 for the customer to check', async () => {
    const repository = new MemoryOrderRepository()
    const actions = createAdminOrderActions({
      repository,
      requireAdmin: async () => undefined,
    })

    const saved = await actions.saveTrackingCode(orderId, '  F123456789  ')
    expect(saved).toMatchObject({ ok: true })
    expect(repository.trackingCode).toBe('F123456789')

    const cleared = await actions.saveTrackingCode(orderId, '   ')
    expect(cleared).toMatchObject({ ok: true })
    expect(repository.trackingCode).toBeNull()

    const tooLong = await actions.saveTrackingCode(orderId, 'F'.repeat(61))
    expect(tooLong).toMatchObject({ ok: false })
  })

  it('puts the tracking code in the shipped email when there is one', () => {
    const withCode = renderOrderShippedEmail({
      orderNumber: 'MORI-TEST',
      email: 'parent@example.com',
      storeChain: 'seven_eleven',
      storeName: '忠孝門市',
      trackingCode: 'F123456789',
    })
    expect(withCode.html).toContain('物流追蹤碼')
    expect(withCode.html).toContain('F123456789')

    const without = renderOrderShippedEmail({ orderNumber: 'MORI-TEST', email: 'parent@example.com' })
    expect(without.html).not.toContain('物流追蹤碼')
  })

  it('authorizes POST form actions before reading form values', () => {
    const orderActions = readFileSync(
      resolve(process.cwd(), 'src/features/admin/order-server-actions.ts'),
      'utf8',
    )
    const settingsActions = readFileSync(
      resolve(process.cwd(), 'src/features/admin/settings-actions.ts'),
      'utf8',
    )
    const orderPost = orderActions.slice(orderActions.indexOf('export async function filterAdminOrders'))
    const settingsPost = settingsActions.slice(settingsActions.indexOf('export async function updateStoreSettingsFromForm'))

    expect(orderPost.indexOf('await requireAdmin()')).toBeGreaterThanOrEqual(0)
    expect(orderPost.indexOf('await requireAdmin()')).toBeLessThan(orderPost.indexOf('formData.get'))
    expect(settingsPost.indexOf('await requireAdmin()')).toBeGreaterThanOrEqual(0)
    expect(settingsPost.indexOf('await requireAdmin()')).toBeLessThan(settingsPost.indexOf('formData.get'))
  })
})
