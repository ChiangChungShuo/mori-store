import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getE2EStore } from '@/testing/e2e-store'
import { recordCouponRedemption, validateCoupon } from '@/features/checkout/coupons'

const promotionId = '20000000-0000-4000-8000-000000000001'

function seedCoupon(overrides: Partial<{
  startsAt: string | null
  endsAt: string | null
  usageLimit: 'unlimited' | 'once_total' | 'once_per_account'
}> = {}) {
  const store = getE2EStore()
  store.promotions = [{
    id: promotionId,
    name: '測試折扣',
    type: 'coupon',
    code: 'SAVE100',
    conditionValue: 500,
    rewardValue: 100,
    giftName: '',
    active: true,
    startsAt: overrides.startsAt ?? null,
    endsAt: overrides.endsAt ?? null,
    usageLimit: overrides.usageLimit ?? 'unlimited',
  }]
  store.promotionRedemptions = []
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('MORI_E2E_FIXTURES', '1')
  vi.stubEnv('VERCEL_ENV', '')
})

afterEach(() => {
  const store = getE2EStore()
  store.promotionRedemptions = []
  vi.unstubAllEnvs()
})

describe('coupon validity window', () => {
  it('rejects a coupon before its start time', async () => {
    seedCoupon({ startsAt: new Date(Date.now() + 86_400_000).toISOString() })
    await expect(validateCoupon('SAVE100', 900)).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining('開始生效'),
    })
  })

  it('rejects a coupon after its end time', async () => {
    seedCoupon({ endsAt: new Date(Date.now() - 3_600_000).toISOString() })
    await expect(validateCoupon('SAVE100', 900)).resolves.toMatchObject({
      ok: false,
      message: '此優惠碼已過期。',
    })
  })

  it('accepts a coupon inside its window', async () => {
    seedCoupon({
      startsAt: new Date(Date.now() - 3_600_000).toISOString(),
      endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
    await expect(validateCoupon('SAVE100', 900)).resolves.toMatchObject({ ok: true, discount: 100 })
  })
})

describe('coupon usage limits', () => {
  it('blocks everyone once a single-use coupon has been redeemed', async () => {
    seedCoupon({ usageLimit: 'once_total' })
    await expect(validateCoupon('SAVE100', 900)).resolves.toMatchObject({ ok: true })

    await recordCouponRedemption('SAVE100', 'first@example.com', 'MORI-1')

    await expect(validateCoupon('SAVE100', 900, 'someone-else@example.com')).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining('已被使用'),
    })
  })

  it('blocks only the account that already used a per-account coupon', async () => {
    seedCoupon({ usageLimit: 'once_per_account' })
    await recordCouponRedemption('SAVE100', 'used@example.com', 'MORI-2')

    await expect(validateCoupon('SAVE100', 900, 'USED@example.com')).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining('每個帳號限用一次'),
    })
    await expect(validateCoupon('SAVE100', 900, 'fresh@example.com')).resolves.toMatchObject({ ok: true })
  })

  it('keeps an unlimited coupon usable after redemptions', async () => {
    seedCoupon({ usageLimit: 'unlimited' })
    await recordCouponRedemption('SAVE100', 'a@example.com', 'MORI-3')
    await recordCouponRedemption('SAVE100', 'b@example.com', 'MORI-4')

    await expect(validateCoupon('SAVE100', 900, 'a@example.com')).resolves.toMatchObject({ ok: true })
  })
})
