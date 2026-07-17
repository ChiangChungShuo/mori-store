import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { OrderCard } from '@/features/orders/order-card'
import {
  createOrderQueries,
  type OrderDetails,
  type OrderQueriesRepository,
} from '@/features/orders/queries'

const parentOrder: OrderDetails = {
  orderNumber: 'MORI-260717-0001',
  email: 'parent@example.com',
  recipientName: '王小美',
  recipientPhone: '0912345678',
  storeChain: 'seven_eleven',
  storeId: '123456',
  storeName: '台北門市',
  subtotal: 720,
  shippingFee: 60,
  total: 780,
  status: 'paid',
  createdAt: '2026-07-17T00:00:00.000Z',
  items: [{
    productName: '有機棉小樹 T 恤',
    sku: 'TEE-100',
    color: '鼠尾草綠',
    size: '100',
    unitPrice: 720,
    quantity: 1,
  }],
}

class MemoryOrderRepository implements OrderQueriesRepository {
  readonly guestLookups: Array<{ orderNumber: string; email: string }> = []

  constructor(
    private readonly orders: Array<OrderDetails & { userId: string | null }>,
  ) {}

  async listOrdersForUser(userId: string) {
    return this.orders.filter((order) => order.userId === userId)
  }

  async getOrderForUser(orderNumber: string, userId: string) {
    return this.orders.find((order) => (
      order.orderNumber === orderNumber && order.userId === userId
    )) ?? null
  }

  async lookupGuestOrder(orderNumber: string, email: string) {
    this.guestLookups.push({ orderNumber, email })
    return this.orders.find((order) => (
      order.orderNumber === orderNumber && order.email === email && order.userId === null
    )) ?? null
  }
}

describe('order access integration', () => {
  it('renders the immutable order snapshot for an authorized result', () => {
    render(createElement(OrderCard, { order: parentOrder }))

    expect(screen.getByText('有機棉小樹 T 恤')).toBeInTheDocument()
    expect(screen.getByText('台北門市（123456）')).toBeInTheDocument()
    expect(screen.getByText('NT$780')).toBeInTheDocument()
    expect(screen.getByText('王小美（0912345678）')).toBeInTheDocument()
  })

  it('requires both order number and normalized email for guest lookup', async () => {
    const repository = new MemoryOrderRepository([{ ...parentOrder, userId: null }])
    const { lookupGuestOrder } = createOrderQueries(repository)

    expect(await lookupGuestOrder('MORI-260717-0001', 'wrong@example.com')).toBeNull()
    expect(await lookupGuestOrder('MORI-260717-0001', ' PARENT@EXAMPLE.COM '))
      .toMatchObject({ orderNumber: 'MORI-260717-0001' })
    expect(await lookupGuestOrder(' MORI-260717-0001 ', 'parent@example.com')).toBeNull()
    expect(repository.guestLookups).toEqual([
      { orderNumber: 'MORI-260717-0001', email: 'wrong@example.com' },
      { orderNumber: 'MORI-260717-0001', email: 'parent@example.com' },
      { orderNumber: ' MORI-260717-0001 ', email: 'parent@example.com' },
    ])
  })

  it('does not return a member order to another member', async () => {
    const repository = new MemoryOrderRepository([{ ...parentOrder, userId: 'member-a' }])
    const { getOrderForUser, listOrdersForUser } = createOrderQueries(repository)

    await expect(getOrderForUser('MORI-260717-0001', 'member-b')).resolves.toBeNull()
    await expect(listOrdersForUser('member-b')).resolves.toEqual([])
  })
})
