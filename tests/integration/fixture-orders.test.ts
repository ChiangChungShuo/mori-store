import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCheckoutService,
  createTestProviderReference,
} from '@/features/checkout/service'
import { listOrdersForUser } from '@/features/orders/queries'
import { createFixtureCheckoutRepository } from '@/testing/e2e-checkout-repository'
import { createE2EOrderRepository } from '@/testing/e2e-order-repository'
import { createE2EStore, getE2EStore, type E2EOrder } from '@/testing/e2e-store'

const liveRepository = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => liveRepository)

const originalNodeEnv = process.env.NODE_ENV
const originalFixtureMode = process.env.MORI_E2E_FIXTURES
const routingOrderNumber = 'MORI-DEMO-ROUTING'

afterEach(() => {
  vi.clearAllMocks()
  getE2EStore().orders.delete(routingOrderNumber)
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
  if (originalFixtureMode === undefined) delete process.env.MORI_E2E_FIXTURES
  else process.env.MORI_E2E_FIXTURES = originalFixtureMode
})

describe('shared fixture orders', () => {
  it('makes a completed member payment visible to member and owner queries', async () => {
    const store = createE2EStore()
    const checkout = createCheckoutService(createFixtureCheckoutRepository({
      store,
      getCurrentUserId: async () => 'customer-a',
    }))

    const { attemptId } = await checkout.createPaymentAttempt({
      email: 'parent@example.com',
      recipientName: '王小美',
      phone: '0912345678',
      chain: 'seven_eleven',
      storeId: '123456',
    }, [{ variantId: '00000000-0000-4000-8000-000000000001', quantity: 2 }])
    const result = await checkout.completeTestPayment(attemptId, 'success')
    const replay = await checkout.completeTestPayment(attemptId, 'success')
    const orders = createE2EOrderRepository(store)

    expect(replay).toEqual(result)
    expect(store.orders).toHaveLength(2)
    const order = store.orders.get(result.orderNumber!)
    expect(order).toEqual({
      id: expect.any(String),
      orderNumber: result.orderNumber,
      userId: 'customer-a',
      email: 'parent@example.com',
      recipientName: '王小美',
      recipientPhone: '0912345678',
      storeChain: 'seven_eleven',
      storeId: '123456',
      storeName: '台北門市',
      subtotal: 1360,
      shippingFee: 60,
      total: 1420,
      status: 'paid',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      items: [{
        id: expect.any(String),
        variantId: '00000000-0000-4000-8000-000000000001',
        productName: '有機棉小樹 T 恤',
        sku: 'MORI-E2E-SAGE-100',
        color: '鼠尾草綠',
        size: '100',
        unitPrice: 680,
        quantity: 2,
      }],
      payment: {
        status: 'paid',
        providerReference: createTestProviderReference(attemptId),
        paidAt: order?.createdAt,
      },
    })
    await expect(orders.listOrdersForUser('customer-a')).resolves.toEqual([{
      orderNumber: result.orderNumber,
      email: 'parent@example.com',
      recipientName: '王小美',
      recipientPhone: '0912345678',
      storeChain: 'seven_eleven',
      storeId: '123456',
      storeName: '台北門市',
      subtotal: 1360,
      shippingFee: 60,
      total: 1420,
      status: 'paid',
      createdAt: order?.createdAt,
      items: [{
        productName: '有機棉小樹 T 恤',
        sku: 'MORI-E2E-SAGE-100',
        color: '鼠尾草綠',
        size: '100',
        unitPrice: 680,
        quantity: 2,
      }],
    }])
    await expect(orders.listOrders({ query: result.orderNumber!, status: '' })).resolves.toEqual([
      expect.objectContaining({ orderNumber: result.orderNumber }),
    ])
    await expect(orders.getOrder(result.orderNumber!)).resolves.toEqual(expect.objectContaining({
      recipientName: '王小美',
      storeChain: 'seven_eleven',
      items: expect.arrayContaining([expect.objectContaining({ quantity: 2 })]),
    }))
  })

  it('keeps member and guest order ownership separate', async () => {
    const store = createE2EStore()
    const orders = createE2EOrderRepository(store)
    const guestOrder = await orders.lookupGuestOrder('MORI-DEMO-1001', 'parent@example.com')

    expect(guestOrder?.orderNumber).toBe('MORI-DEMO-1001')
    await expect(orders.listOrdersForUser('customer-a')).resolves.toEqual([])
    await expect(orders.getOrderForUser('MORI-DEMO-1001', 'customer-a')).resolves.toBeNull()

    const memberOrder = {
      ...store.orders.get('MORI-DEMO-1001')!,
      id: '00000000-0000-4000-8000-000000001003',
      orderNumber: 'MORI-DEMO-MEMBER',
      userId: 'customer-a',
    }
    store.orders.set(memberOrder.orderNumber, memberOrder)

    await expect(orders.lookupGuestOrder(memberOrder.orderNumber, memberOrder.email))
      .resolves.toBeNull()
    await expect(orders.getOrderForUser(memberOrder.orderNumber, 'customer-b'))
      .resolves.toBeNull()
  })

  it('uses the fixture store only in fixture mode and keeps the live resolver unchanged', async () => {
    const fixtureOrder: E2EOrder = {
      ...getE2EStore().orders.get('MORI-DEMO-1001')!,
      id: '00000000-0000-4000-8000-000000001004',
      orderNumber: routingOrderNumber,
      userId: 'routing-customer',
    }
    getE2EStore().orders.set(fixtureOrder.orderNumber, fixtureOrder)

    process.env.NODE_ENV = 'test'
    process.env.MORI_E2E_FIXTURES = '1'
    await expect(listOrdersForUser('routing-customer')).resolves.toEqual([
      expect.objectContaining({ orderNumber: fixtureOrder.orderNumber }),
    ])
    expect(liveRepository.createClient).not.toHaveBeenCalled()

    const orderQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(async () => ({ data: [], error: null })),
    }
    orderQuery.select.mockReturnValue(orderQuery)
    orderQuery.eq.mockReturnValue(orderQuery)
    liveRepository.createClient.mockResolvedValue({ from: () => orderQuery })
    process.env.NODE_ENV = 'production'

    await expect(listOrdersForUser('routing-customer')).resolves.toEqual([])
    expect(liveRepository.createClient).toHaveBeenCalledOnce()
  })
})
