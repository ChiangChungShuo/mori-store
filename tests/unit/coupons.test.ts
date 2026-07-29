import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateCoupon } from '@/features/checkout/coupons'

afterEach(() => vi.unstubAllEnvs())

describe('validateCoupon', () => {
  it('reads active fixture coupons and enforces their minimum spend', async () => {
    vi.stubEnv('MORI_E2E_FIXTURES', '1')

    expect(await validateCoupon('hellomori', 999)).toMatchObject({ ok: false, discount: 0 })
    expect(await validateCoupon('hellomori', 1000)).toEqual({
      ok: true,
      code: 'HELLOMORI',
      discount: 100,
      message: '已套用 HELLOMORI，折抵 NT$100。',
    })
  })
})
