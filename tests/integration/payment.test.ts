import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
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
  storeName: '被竄改的門市名稱',
}

class MemoryCheckoutRepository implements CheckoutRepository {
  readonly attempts: Array<PaymentAttemptInsert & {
    id: string
    status: string
    orderNumber: string | null
  }> = []
  readonly completionCalls: Array<{ attemptId: string; providerReference: string }> = []
  readonly guestTokens = new Map<string, string>()
  readonly stock = new Map(variants.map((variant) => [variant.id, variant.stock]))
  orderCount = 0
  currentUserId: string | null
  private readonly completedOrders = new Map<string, { orderNumber: string }>()

  constructor(
    private readonly availableVariants = variants,
    currentUserId: string | null = null,
  ) {
    this.currentUserId = currentUserId
  }

  async getCurrentUserId() {
    return this.currentUserId
  }

  async getGuestAccessToken(attemptId: string) {
    return this.guestTokens.get(attemptId) ?? null
  }

  async setGuestAccessToken(attemptId: string, token: string) {
    this.guestTokens.set(attemptId, token)
  }

  async getPaymentAttemptAccess(attemptId: string) {
    const attempt = this.attempts.find((candidate) => candidate.id === attemptId)
    return attempt ? {
      userId: attempt.userId,
      paymentAccessTokenHash: attempt.paymentAccessTokenHash,
      paymentAccessExpiresAt: attempt.paymentAccessExpiresAt,
    } : null
  }

  async getVariants() {
    return this.availableVariants
  }

  async getStoreSettings() {
    return { shippingFee: 60, freeShippingThreshold: 1500 }
  }

  async insertPaymentAttempt(attempt: PaymentAttemptInsert) {
    const id = `cccccccc-cccc-4ccc-8ccc-${(this.attempts.length + 1).toString().padStart(12, '0')}`
    this.attempts.push({ ...attempt, id, status: 'pending', orderNumber: null })
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
    attempt.orderNumber = order.orderNumber
    this.completedOrders.set(providerReference, order)
    return order
  }

  async getCompletedOrderForAttempt(attemptId: string) {
    const attempt = this.attempts.find((candidate) => candidate.id === attemptId)
    return attempt?.orderNumber ? {
      orderNumber: attempt.orderNumber,
      storeChain: attempt.storeChain,
      storeId: attempt.storeId,
      storeName: attempt.storeName,
      status: 'paid',
    } : null
  }
}

describe('checkout payment integration', () => {
  it('accepts only same-origin JSON at the payment route boundary', async () => {
    const crossSite = await POST(new NextRequest('http://localhost/api/test-payment', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://attacker.example' },
      body: JSON.stringify({}),
    }))
    const missingOrigin = await POST(new NextRequest('http://localhost/api/test-payment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }))
    const wrongType = await POST(new NextRequest('http://localhost/api/test-payment', {
      method: 'POST',
      headers: { 'content-type': 'text/plain', origin: 'http://localhost' },
      body: '{}',
    }))
    const malformed = await POST(new NextRequest('http://localhost/api/test-payment', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', origin: 'http://localhost' },
      body: JSON.stringify({
        attemptId: 'not-a-uuid',
        outcome: 'success',
        providerReference: 'browser-controlled',
      }),
    }))

    expect(crossSite.status).toBe(403)
    expect(missingOrigin.status).toBe(403)
    expect(wrongType.status).toBe(415)
    expect(malformed.status).toBe(400)
  })

  it('stores a high-entropy guest token hash and canonical server data only', async () => {
    const repository = new MemoryCheckoutRepository()
    const service = createCheckoutService(repository)

    const result = await service.createPaymentAttempt(checkoutInput, [
      { variantId: teeId, quantity: 2, unitPrice: 1 } as { variantId: string; quantity: number },
    ])
    const token = repository.guestTokens.get(result.attemptId)

    expect(repository.attempts[0]).toMatchObject({
      userId: null,
      email: 'parent@example.com',
      storeName: '台北門市',
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
    expect(token?.length).toBeGreaterThanOrEqual(43)
    expect(repository.attempts[0].paymentAccessTokenHash).toBe(
      createHash('sha256').update(token ?? '').digest('hex'),
    )
    expect(new Date(repository.attempts[0].paymentAccessExpiresAt).getTime())
      .toBeGreaterThan(Date.now() + 59 * 60 * 1000)
    expect(JSON.stringify(repository.attempts[0])).not.toContain(token)
    expect(result).toEqual({ attemptId: repository.attempts[0].id })
  })

  it('stores no guest token for a signed-in member', async () => {
    const repository = new MemoryCheckoutRepository(variants, 'member-a')
    const service = createCheckoutService(repository)

    const { attemptId } = await service.createPaymentAttempt(
      checkoutInput,
      [{ variantId: teeId, quantity: 1 }],
    )

    expect(repository.attempts[0]).toMatchObject({
      userId: 'member-a',
      paymentAccessTokenHash: null,
    })
    expect(repository.guestTokens.has(attemptId)).toBe(false)
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

  it('rejects unknown and cross-chain stores and ignores a tampered store name', async () => {
    const unknownStore = { ...checkoutInput, storeId: 'unknown', storeName: '任意門市' }
    const crossChain = {
      ...checkoutInput,
      chain: 'family_mart' as const,
      storeId: '123456',
      storeName: '全家假門市',
    }

    await expect(createCheckoutService(new MemoryCheckoutRepository())
      .createPaymentAttempt(unknownStore, [{ variantId: teeId, quantity: 1 }]))
      .rejects.toThrow('不支援的取貨門市')
    await expect(createCheckoutService(new MemoryCheckoutRepository())
      .createPaymentAttempt(crossChain, [{ variantId: teeId, quantity: 1 }]))
      .rejects.toThrow('不支援的取貨門市')
  })

  it('rejects member and guest access that does not own the attempt', async () => {
    const memberRepository = new MemoryCheckoutRepository(variants, 'member-a')
    const memberService = createCheckoutService(memberRepository)
    const memberAttempt = await memberService.createPaymentAttempt(
      checkoutInput,
      [{ variantId: teeId, quantity: 1 }],
    )
    memberRepository.currentUserId = 'member-b'

    await expect(memberService.completeTestPayment(memberAttempt.attemptId, 'success'))
      .rejects.toThrow('無權存取付款交易')
    expect(memberRepository.completionCalls).toHaveLength(0)

    const guestRepository = new MemoryCheckoutRepository()
    const guestService = createCheckoutService(guestRepository)
    const guestAttempt = await guestService.createPaymentAttempt(
      checkoutInput,
      [{ variantId: teeId, quantity: 1 }],
    )
    guestRepository.guestTokens.set(guestAttempt.attemptId, 'wrong-token')

    await expect(guestService.completeTestPayment(guestAttempt.attemptId, 'success'))
      .rejects.toThrow('無權存取付款交易')
    expect(guestRepository.completionCalls).toHaveLength(0)
  })

  it('uses a retry-safe provider reference and returns the same order on replay', async () => {
    const repository = new MemoryCheckoutRepository()
    const service = createCheckoutService(repository)
    const { attemptId } = await service.createPaymentAttempt(
      checkoutInput,
      [{ variantId: teeId, quantity: 1 }],
    )

    const first = await service.completeTestPayment(attemptId, 'success')
    const replay = await service.completeTestPayment(attemptId.toUpperCase(), 'success')

    expect(first).toEqual({
      outcome: 'success',
      orderNumber: 'MORI-ORDER-1',
      redirectUrl: `/order-complete/MORI-ORDER-1?attemptId=${attemptId}`,
    })
    expect(replay).toEqual(first)
    expect(repository.completionCalls[0].providerReference)
      .toBe(repository.completionCalls[1].providerReference)
    expect(repository.orderCount).toBe(1)
    expect(repository.stock.get(teeId)).toBe(4)
  })

  it('authorizes completed orders only through the matching owned attempt', async () => {
    const repository = new MemoryCheckoutRepository()
    const service = createCheckoutService(repository)
    const { attemptId } = await service.createPaymentAttempt(
      checkoutInput,
      [{ variantId: teeId, quantity: 1 }],
    )
    await service.completeTestPayment(attemptId, 'success')
    const securedService = service as typeof service & {
      getAuthorizedCompletedOrder(id: string, orderNumber: string): Promise<unknown>
    }

    await expect(securedService.getAuthorizedCompletedOrder(attemptId, 'MORI-ORDER-1'))
      .resolves.toMatchObject({ orderNumber: 'MORI-ORDER-1', storeName: '台北門市' })
    await expect(securedService.getAuthorizedCompletedOrder(attemptId, 'MORI-OTHER'))
      .resolves.toBeNull()

    repository.guestTokens.set(attemptId, 'wrong-token')
    await expect(securedService.getAuthorizedCompletedOrder(attemptId, 'MORI-ORDER-1'))
      .rejects.toThrow('無權存取付款交易')
  })

  it('rejects expired guest access before payment update and completed-order read', async () => {
    const updateRepository = new MemoryCheckoutRepository()
    const updateService = createCheckoutService(updateRepository)
    const updateAttempt = await updateService.createPaymentAttempt(
      checkoutInput,
      [{ variantId: teeId, quantity: 1 }],
    )
    updateRepository.attempts[0].paymentAccessExpiresAt = new Date(Date.now() - 1).toISOString()

    await expect(updateService.completeTestPayment(updateAttempt.attemptId, 'failure'))
      .rejects.toThrow('無權存取付款交易')
    await expect(updateService.completeTestPayment(updateAttempt.attemptId, 'success'))
      .rejects.toThrow('無權存取付款交易')
    expect(updateRepository.attempts[0].status).toBe('pending')
    expect(updateRepository.completionCalls).toHaveLength(0)

    const readRepository = new MemoryCheckoutRepository()
    const readService = createCheckoutService(readRepository)
    const readAttempt = await readService.createPaymentAttempt(
      checkoutInput,
      [{ variantId: teeId, quantity: 1 }],
    )
    await readService.completeTestPayment(readAttempt.attemptId, 'success')
    readRepository.attempts[0].paymentAccessExpiresAt = new Date(Date.now() - 1).toISOString()

    await expect(readService.getAuthorizedCompletedOrder(readAttempt.attemptId, 'MORI-ORDER-1'))
      .rejects.toThrow('無權存取付款交易')
  })

  it('does not apply guest expiry to member ownership', async () => {
    const repository = new MemoryCheckoutRepository(variants, 'member-a')
    const service = createCheckoutService(repository)
    const { attemptId } = await service.createPaymentAttempt(
      checkoutInput,
      [{ variantId: teeId, quantity: 1 }],
    )
    repository.attempts[0].paymentAccessExpiresAt = new Date(Date.now() - 1).toISOString()

    await expect(service.completeTestPayment(attemptId, 'success'))
      .resolves.toMatchObject({ orderNumber: 'MORI-ORDER-1' })
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
