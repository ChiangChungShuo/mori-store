import { describe, expect, it } from 'vitest'
import {
  createCheckoutService,
  type CheckoutRepository,
  type CheckoutVariant,
  type PaymentAttemptInsert,
  type PaymentCompletion,
} from '@/features/checkout/service'
import type { CouponValidation } from '@/features/checkout/coupons'

const greenTeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const blueTeeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const pantsId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

// Two variants of ONE product (same slug + tiers) plus an untiered product.
const variants: CheckoutVariant[] = [
  {
    id: greenTeeId,
    productName: '有機棉小樹 T 恤',
    productSlug: 'mori-tee',
    sku: 'TEE-G-100',
    color: '鼠尾草綠',
    size: '100',
    price: 590,
    stock: 10,
    isPublished: true,
    imageUrl: null,
    quantityPrices: [
      { quantity: 2, bundlePrice: 1000 },
      { quantity: 3, bundlePrice: 1350 },
    ],
  },
  {
    id: blueTeeId,
    productName: '有機棉小樹 T 恤',
    productSlug: 'mori-tee',
    sku: 'TEE-B-110',
    color: '海軍藍',
    size: '110',
    price: 590,
    stock: 10,
    isPublished: true,
    imageUrl: null,
    quantityPrices: [
      { quantity: 2, bundlePrice: 1000 },
      { quantity: 3, bundlePrice: 1350 },
    ],
  },
  {
    id: pantsId,
    productName: '自在長褲',
    productSlug: 'mori-pants',
    sku: 'PANTS-110',
    color: '海軍藍',
    size: '110',
    price: 880,
    stock: 10,
    isPublished: true,
    imageUrl: null,
    quantityPrices: [],
  },
]

const checkoutInput = {
  email: 'parent@example.com',
  recipientName: '王小美',
  phone: '0912345678',
  chain: 'seven_eleven' as const,
  storeId: '123456',
  storeName: '台北門市',
}

class MemoryRepository implements CheckoutRepository {
  readonly attempts: Array<PaymentAttemptInsert & { id: string }> = []

  async getCurrentUserId() { return null }
  async getMemberCreditBalance() { return 0 }
  async getGuestAccessToken() { return null }
  async setGuestAccessToken() {}
  async getPaymentAttemptAccess() { return null }
  async getPaymentAttemptSummary() { return null }
  async getVariants() { return variants }
  async getStoreSettings() { return { shippingFee: 60, freeShippingThreshold: 1500 } }
  async insertPaymentAttempt(attempt: PaymentAttemptInsert) {
    const id = `dddddddd-dddd-4ddd-8ddd-${(this.attempts.length + 1).toString().padStart(12, '0')}`
    this.attempts.push({ ...attempt, id })
    return { id }
  }
  async updatePaymentAttemptStatus() {}
  async completePayment(): Promise<PaymentCompletion> { return { status: 'paid', orderNumber: 'MORI-1' } }
  async getCompletedOrderForAttempt() { return null }
}

async function attemptFor(cart: Array<{ variantId: string; quantity: number }>, coupon?: CouponValidation) {
  const repository = new MemoryRepository()
  const service = createCheckoutService(
    repository,
    coupon ? async () => coupon : undefined,
  )
  await service.createPaymentAttempt(
    { ...checkoutInput, ...(coupon ? { couponCode: 'SAVE100' } : {}) },
    cart,
  )
  return repository.attempts[0]
}

describe('quantity pricing at checkout', () => {
  it('applies a tier across two variants of the same product', async () => {
    const attempt = await attemptFor([
      { variantId: greenTeeId, quantity: 1 },
      { variantId: blueTeeId, quantity: 1 },
    ])

    expect(attempt).toMatchObject({
      subtotal: 1180,
      bundleDiscount: 180,
      shippingFee: 60,
      total: 1060,
    })
  })

  it('leaves an untiered product at its unit price', async () => {
    const attempt = await attemptFor([{ variantId: pantsId, quantity: 2 }])

    expect(attempt).toMatchObject({
      subtotal: 1760,
      bundleDiscount: 0,
      shippingFee: 0, // 1760 clears the 1500 free-shipping threshold
      total: 1760,
    })
  })

  it('charges shipping when the bundle discount drops the order under the threshold', async () => {
    // 3 × 590 = 1770 would ship free, but the 1350 bundle price does not.
    const attempt = await attemptFor([{ variantId: greenTeeId, quantity: 3 }])

    expect(attempt).toMatchObject({
      subtotal: 1770,
      bundleDiscount: 420,
      shippingFee: 60,
      total: 1410,
    })
  })

  it('does not pool quantities across different products', async () => {
    const attempt = await attemptFor([
      { variantId: greenTeeId, quantity: 1 },
      { variantId: pantsId, quantity: 1 },
    ])

    expect(attempt.bundleDiscount).toBe(0)
    expect(attempt.subtotal).toBe(1470)
  })

  it('stacks a coupon on top of the bundle price', async () => {
    const attempt = await attemptFor(
      [{ variantId: greenTeeId, quantity: 2 }],
      { ok: true, code: 'SAVE100', discount: 100, message: '已套用優惠碼' },
    )

    // 1180 subtotal → 1000 after the bundle → 900 after the coupon → +60 shipping.
    expect(attempt).toMatchObject({
      subtotal: 1180,
      bundleDiscount: 180,
      discount: 100,
      couponCode: 'SAVE100',
      shippingFee: 60,
      total: 960,
    })
  })

  it('keeps the raw subtotal so the order RPC price check still passes', async () => {
    const attempt = await attemptFor([{ variantId: greenTeeId, quantity: 2 }])

    // complete_test_payment recomputes sum(unit_price × qty) and compares it to
    // subtotal, so the bundle discount must never be folded into subtotal.
    expect(attempt.subtotal).toBe(590 * 2)
    expect(attempt.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0))
      .toBe(attempt.subtotal)
  })
})
