import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/test-payment/route'
import {
  createCheckoutService,
  type CheckoutRepository,
  type CheckoutVariant,
  type PaymentAttemptInsert,
} from '@/features/checkout/service'

const teeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const pantsId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const variants: CheckoutVariant[] = [
  {
    id: teeId,
    productName: '有機棉小樹 T 恤',
    sku: 'TEE-100',
    color: '鼠尾草綠',
    size: '100',
    price: 720,
    stock: 5,
    isPublished: true,
  },
  {
    id: pantsId,
    productName: '自在長褲',
    sku: 'PANTS-110',
    color: '海軍藍',
    size: '110',
    price: 880,
    stock: 0,
    isPublished: true,
  },
]

const checkoutInput = {
  email: 'PARENT@example.com',
  userId: 'browser-controlled-user',
  recipientName: '王小美',
  phone: '0912345678',
  chain: 'seven_eleven' as const,
  storeId: '123456',
  storeName: '台北門市',
}

class MemoryCheckoutRepository implements CheckoutRepository {
  readonly attempts: Array<PaymentAttemptInsert & { id: string; status: string }> = []
  readonly completionCalls: Array<{ attemptId: string; providerReference: string }> = []
  readonly stock = new Map(variants.map((variant) => [variant.id, variant.stock]))
  orderCount = 0
  private readonly completedOrders = new Map<string, { orderNumber: string }>()

  constructor(private readonly availableVariants = variants) {}

  async getCurrentUserId() {
    return null
  }

  async getVariants() {
    return this.availableVariants
  }

  async getStoreSettings() {
    return { shippingFee: 60, freeShippingThreshold: 1500 }
  }

  async insertPaymentAttempt(attempt: PaymentAttemptInsert) {
    const id = `attempt-${this.attempts.length + 1}`
    this.attempts.push({ ...attempt, id, status: 'pending' })
    return { id }
  }

  async updatePaymentAttemptStatus(attemptId: string, status: 'failed' | 'cancelled') {
    const attempt = this.attempts.find((candidate) => candidate.id === attemptId)
    if (!attempt) throw new Error('payment attempt not found')
    attempt.status = status
  }

  async completePayment(attemptId: string, providerReference: string) {
    this.completionCalls.push({ attemptId, providerReference })
    const completed = this.completedOrders.get(providerReference)
    if (completed) return completed

    const attempt = this.attempts.find((candidate) => candidate.id === attemptId)
    if (!attempt) throw new Error('payment attempt not found')
    for (const item of attempt.items) {
      this.stock.set(item.variant_id, (this.stock.get(item.variant_id) ?? 0) - item.quantity)
    }

    this.orderCount += 1
    const order = { orderNumber: `MORI-ORDER-${this.orderCount}` }
    this.completedOrders.set(providerReference, order)
    return order
  }
}

describe('checkout payment integration', () => {
  it('rejects malformed payment requests at the route boundary', async () => {
    const response = await POST(new Request('http://localhost/api/test-payment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        attemptId: 'not-a-uuid',
        outcome: 'success',
        providerReference: 'browser-controlled',
      }),
    }))

    expect(response.status).toBe(400)
  })

  it('reloads prices and settings and stores a server-owned snapshot', async () => {
    const repository = new MemoryCheckoutRepository()
    const service = createCheckoutService(repository)

    await service.createPaymentAttempt(checkoutInput, [
      { variantId: teeId, quantity: 2, unitPrice: 1 } as { variantId: string; quantity: number },
    ])

    expect(repository.attempts[0]).toMatchObject({
      userId: null,
      email: 'parent@example.com',
      subtotal: 1440,
      shippingFee: 60,
      total: 1500,
      items: [{
        variant_id: teeId,
        quantity: 2,
        unit_price: 720,
        product_name: '有機棉小樹 T 恤',
      }],
    })
  })

  it('rejects missing, unpublished and out-of-stock variants', async () => {
    const unpublished = { ...variants[0], isPublished: false }

    await expect(createCheckoutService(new MemoryCheckoutRepository([]))
      .createPaymentAttempt(checkoutInput, [{ variantId: teeId, quantity: 1 }]))
      .rejects.toThrow('商品已下架或不存在')
    await expect(createCheckoutService(new MemoryCheckoutRepository([unpublished]))
      .createPaymentAttempt(checkoutInput, [{ variantId: teeId, quantity: 1 }]))
      .rejects.toThrow('商品已下架或不存在')
    await expect(createCheckoutService(new MemoryCheckoutRepository())
      .createPaymentAttempt(checkoutInput, [{ variantId: pantsId, quantity: 1 }]))
      .rejects.toThrow('庫存不足')
  })

  it('uses a retry-safe provider reference and returns the same order on replay', async () => {
    const repository = new MemoryCheckoutRepository()
    const service = createCheckoutService(repository)
    const { attemptId } = await service.createPaymentAttempt(
      checkoutInput,
      [{ variantId: teeId, quantity: 1 }],
    )

    const first = await service.completeTestPayment(attemptId, 'success')
    const replay = await service.completeTestPayment(attemptId, 'success')

    expect(first).toEqual({
      outcome: 'success',
      orderNumber: 'MORI-ORDER-1',
      redirectUrl: '/order-complete/MORI-ORDER-1',
    })
    expect(replay).toEqual(first)
    expect(repository.completionCalls[0].providerReference)
      .toBe(repository.completionCalls[1].providerReference)
    expect(repository.orderCount).toBe(1)
    expect(repository.stock.get(teeId)).toBe(4)
  })

  it.each(['failure', 'cancelled'] as const)(
    'persists %s and returns checkout without completing an order',
    async (outcome) => {
      const repository = new MemoryCheckoutRepository()
      const service = createCheckoutService(repository)
      const { attemptId } = await service.createPaymentAttempt(
        checkoutInput,
        [{ variantId: teeId, quantity: 1 }],
      )

      await expect(service.completeTestPayment(attemptId, outcome)).resolves.toEqual({
        outcome,
        redirectUrl: `/checkout?payment=${outcome}`,
      })
      expect(repository.attempts[0].status).toBe(
        outcome === 'failure' ? 'failed' : 'cancelled',
      )
      expect(repository.completionCalls).toHaveLength(0)
    },
  )
})
