import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkoutSchema } from '@/lib/validation/checkout'
import { createCheckoutService } from '@/features/checkout/service'
import { createE2EStore } from '@/testing/e2e-store'
import { createFixtureCheckoutRepository } from '@/testing/e2e-checkout-repository'
import { showsDemoCredentials } from '@/testing/e2e-mode'

// The fixture repository stores the guest access token in a cookie.
const serverCookies = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (serverCookies.has(name) ? { value: serverCookies.get(name) } : undefined),
    set: (name: string, value: string) => { serverCookies.set(name, value) },
    delete: (name: string) => { serverCookies.delete(name) },
  }),
}))

beforeEach(() => serverCookies.clear())

const customer = {
  email: 'parent@example.com',
  recipientName: '王小美',
  phone: '0912345678',
  chain: 'seven_eleven' as const,
  storeId: '123456',
  storeName: '台北門市',
  customerNote: '',
}

describe('payment method tampering', () => {
  it('rejects the test gateway when it is submitted through the checkout form', () => {
    const tampered = checkoutSchema.safeParse({ ...customer, paymentMethod: 'online_test' })
    expect(tampered.success).toBe(false)

    expect(checkoutSchema.safeParse({ ...customer, paymentMethod: 'bank_transfer' }).success).toBe(true)
    expect(checkoutSchema.safeParse({ ...customer, paymentMethod: 'convenience_cod' }).success).toBe(false)
  })

  it('rejects a new checkout attempt without a signed-in member', async () => {
    const store = createE2EStore()
    const checkout = createCheckoutService(createFixtureCheckoutRepository({
      store,
      getCurrentUserId: async () => null,
    }))

    await expect(checkout.createPaymentAttempt(
      { ...customer, paymentMethod: 'bank_transfer' },
      [{ variantId: '00000000-0000-4000-8000-000000000001', quantity: 1 }],
    )).rejects.toThrow('請先登入會員再結帳')
  })

  it('never marks a submitted order as paid: bank transfers wait for the money', async () => {
    const store = createE2EStore()
    const checkout = createCheckoutService(createFixtureCheckoutRepository({
      store,
      getCurrentUserId: async () => 'member-1',
    }))

    const { attemptId } = await checkout.createPaymentAttempt(
      { ...customer, paymentMethod: 'bank_transfer' },
      [{ variantId: '00000000-0000-4000-8000-000000000001', quantity: 1 }],
    )
    const submitted = await checkout.submitOrder(attemptId)
    const order = store.orders.get(submitted.orderNumber)

    expect(order?.status).toBe('pending_payment')
    expect(order?.payment?.status).toBe('submitted')
  })

  it('keeps the test gateway out of the live database path', () => {
    // The guard is structural: the live repository refuses the RPC that marks an
    // order paid without money, so no env flag or request shape can reach it.
    const service = readFileSync(resolve(process.cwd(), 'src/features/checkout/service.ts'), 'utf8')
    const liveRepository = service.slice(service.indexOf('async function createLiveRepository'))

    expect(liveRepository).toMatch(/if \(options\?\.useTestGateway\) throw new Error/)
    expect(liveRepository).not.toMatch(/complete_test_payment/)
    // Only the explicit test-payment call may ask for the gateway at all.
    expect(service.match(/useTestGateway: true/g) ?? []).toHaveLength(1)
  })
})

describe('demo credentials', () => {
  it('are shown on a developer machine but never on a deployment', () => {
    expect(showsDemoCredentials({ NODE_ENV: 'development', MORI_E2E_FIXTURES: '1' })).toBe(true)
    // Preview builds run on fixtures, but their URLs are public.
    expect(showsDemoCredentials({ VERCEL_ENV: 'preview' })).toBe(false)
    expect(showsDemoCredentials({ VERCEL_ENV: 'production' })).toBe(false)
  })
})
