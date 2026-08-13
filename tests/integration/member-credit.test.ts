import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCheckoutService } from '@/features/checkout/service'
import type { CheckoutRepository, PaymentAttemptInsert } from '@/features/checkout/service'
import { createFixtureCheckoutRepository } from '@/testing/e2e-checkout-repository'
import { createE2EStore } from '@/testing/e2e-store'
import { getMutableE2EProducts } from '@/testing/e2e-storefront-fixtures'
import { getMemberCreditBalance } from '@/features/account/member-credit'

vi.stubEnv('MORI_E2E_FIXTURES', '1')

const variantId = '20000000-0000-4000-8000-000000000001'
const memberId = '30000000-0000-4000-8000-000000000001'

const customer = {
  email: 'parent@example.com',
  recipientName: '王小美',
  phone: '0912345678',
  chain: 'seven_eleven' as const,
  storeName: '忠孝門市',
  storeId: '123456',
  paymentMethod: 'bank_transfer' as const,
}

function createRepository(options: { userId: string | null; balance: number }) {
  const attempts: PaymentAttemptInsert[] = []
  const repository: CheckoutRepository = {
    async getCurrentUserId() { return options.userId },
    async getGuestAccessToken() { return null },
    async setGuestAccessToken() {},
    async getPaymentAttemptAccess() { return null },
    async getPaymentAttemptSummary() { return null },
    async getVariants() {
      return [{
        id: variantId,
        productId: 'product-1',
        productName: '有機棉小樹 T 恤',
        productSlug: 'mori-tree-tee',
        sku: 'TEE-100',
        color: '綠',
        size: '100',
        price: 680,
        stock: 5,
        isPublished: true,
        imageUrl: null,
        quantityPrices: [],
      }]
    },
    async getStoreSettings() { return { shippingFee: 60, freeShippingThreshold: 1500 } },
    async getMemberCreditBalance(userId) { return userId === options.userId ? options.balance : 0 },
    async insertPaymentAttempt(attempt) {
      attempts.push(attempt)
      return { id: '40000000-0000-4000-8000-000000000001' }
    },
    async updatePaymentAttemptStatus() {},
    async completePayment() { return { status: 'paid', orderNumber: 'MORI-1' } },
    async getCompletedOrderForAttempt() { return null },
  }
  return { repository, attempts }
}

describe('購物金 at checkout', () => {
  it('spends the balance automatically, with no coupon code', async () => {
    const { repository, attempts } = createRepository({ userId: memberId, balance: 50 })
    const service = createCheckoutService(repository)

    await service.createPaymentAttempt(customer, [{ variantId, quantity: 1 }])

    // 680 + 60 shipping = 740, less the 50 gift.
    expect(attempts[0]).toMatchObject({ creditApplied: 50, total: 690 })
  })

  it('never discounts more than the balance or more than the order', async () => {
    const rich = createRepository({ userId: memberId, balance: 5000 })
    await createCheckoutService(rich.repository).createPaymentAttempt(customer, [{ variantId, quantity: 1 }])
    expect(rich.attempts[0]).toMatchObject({ creditApplied: 740, total: 0 })

    const empty = createRepository({ userId: memberId, balance: 0 })
    await createCheckoutService(empty.repository).createPaymentAttempt(customer, [{ variantId, quantity: 1 }])
    expect(empty.attempts[0]).toMatchObject({ creditApplied: 0, total: 740 })
  })

  it('rejects checkout when there is no signed-in member', async () => {
    const { repository } = createRepository({ userId: null, balance: 500 })
    await expect(createCheckoutService(repository).createPaymentAttempt(customer, [{ variantId, quantity: 1 }]))
      .rejects.toThrow('請先登入會員再結帳')
  })
})

describe('購物金 ledger migration', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260810080000_member_credits.sql'),
    'utf8',
  )

  it('lets the database, not the app, guarantee one gift and one spend each', () => {
    expect(sql).toMatch(/unique index[\s\S]*member_credits_signup_gift_key[\s\S]*where reason = 'signup_gift'/)
    expect(sql).toMatch(/unique index[\s\S]*member_credits_order_key[\s\S]*where reason = 'order'/)
  })

  it('reads the gift amount from settings instead of trusting the caller', () => {
    expect(sql).toMatch(/create or replace function public\.claim_signup_credit\(\)/)
    expect(sql).toMatch(/from public\.store_settings where key = 'welcome_gift'/)
  })

  it('refuses to over-spend a balance when two checkouts finish at once', () => {
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtext\('member_credit:'/)
    expect(sql).toMatch(/insufficient_member_credit/)
  })

  it('keeps members from writing their own credit rows', () => {
    expect(sql).toMatch(/alter table public\.member_credits enable row level security/)
    expect(sql).toMatch(/for select\s*\nusing \(auth\.uid\(\) = user_id or public\.is_admin\(\)\)/)
  })
})


describe('購物金 ledger in the in-memory store', () => {
  let store: ReturnType<typeof createE2EStore>

  beforeEach(() => {
    store = createE2EStore()
    store.memberCredits.push({
      userId: memberId,
      amount: 50,
      reason: 'signup_gift',
      orderId: null,
      createdAt: '2026-08-10T00:00:00.000Z',
    })
  })

  function attemptFor(creditApplied: number, userId: string | null = memberId) {
    const product = getMutableE2EProducts(store)[0]
    const variant = product.variants[0]
    return {
      userId,
      email: 'parent@example.com',
      recipientName: '王小美',
      recipientPhone: '0912345678',
      storeChain: 'seven_eleven' as const,
      storeId: '123456',
      storeName: '忠孝門市',
      customerNote: '',
      paymentMethod: 'bank_transfer' as const,
      subtotal: variant.price,
      shippingFee: 60,
      total: variant.price + 60 - creditApplied,
      bundleDiscount: 0,
      creditApplied,
      discount: 0,
      couponCode: null,
      items: [{
        variant_id: variant.id,
        quantity: 1,
        unit_price: variant.price,
        product_name: product.name,
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
        image_url: null,
      }],
      paymentAccessExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
      paymentAccessTokenHash: null,
    }
  }

  it('records the spend against the order and leaves the balance at zero', async () => {
    const repository = createFixtureCheckoutRepository({ store })
    const { id } = await repository.insertPaymentAttempt(attemptFor(50))

    const completion = await repository.completePayment(id, `manual-order:${id}`)

    expect(completion.status).toBe('paid')
    expect(store.memberCredits.map((entry) => entry.amount)).toEqual([50, -50])
    expect(store.memberCredits[1].reason).toBe('order')
    expect(store.memberCredits[1].orderId).toBeTruthy()
  })

  it('refuses an order that would spend more credit than the member has', async () => {
    const repository = createFixtureCheckoutRepository({ store })
    const { id } = await repository.insertPaymentAttempt(attemptFor(500))

    await expect(repository.completePayment(id, `manual-order:${id}`))
      .rejects.toThrow('insufficient_member_credit')
  })

  it('reads a member balance and ignores other accounts', async () => {
    store.memberCredits.push({
      userId: '30000000-0000-4000-8000-000000000002',
      amount: 999,
      reason: 'manual',
      orderId: null,
      createdAt: '2026-08-10T00:00:00.000Z',
    })
    const repository = createFixtureCheckoutRepository({ store })

    expect(await repository.getMemberCreditBalance(memberId)).toBe(50)
    expect(await repository.getMemberCreditBalance('30000000-0000-4000-8000-000000000009')).toBe(0)
    expect(typeof getMemberCreditBalance).toBe('function')
  })
})
