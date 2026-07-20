import type { AdminOrderQueryRepository, AdminOrderRepository } from '@/features/admin/order-actions'
import type { OrderDetails, OrderQueriesRepository } from '@/features/orders/queries'
import type { E2EOrder, E2EStoreState } from '@/testing/e2e-store'

function memberOrder(order: E2EOrder): OrderDetails {
  return {
    orderNumber: order.orderNumber,
    email: order.email,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    storeChain: order.storeChain,
    storeId: order.storeId,
    storeName: order.storeName,
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
    items: order.items.map(({ productName, sku, color, size, unitPrice, quantity }) => ({
      productName, sku, color, size, unitPrice, quantity,
    })),
  }
}

function ownerOrder(order: E2EOrder) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    recipientName: order.recipientName,
    email: order.email,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
  }
}

export function createE2EOrderRepository(store: E2EStoreState):
  OrderQueriesRepository & AdminOrderQueryRepository & AdminOrderRepository {
  return {
    async listOrdersForUser(userId) {
      return [...store.orders.values()]
        .filter((order) => order.userId === userId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(memberOrder)
    },
    async getOrderForUser(orderNumber, userId) {
      const order = store.orders.get(orderNumber)
      return order?.userId === userId ? memberOrder(order) : null
    },
    async lookupGuestOrder(orderNumber, email) {
      const order = store.orders.get(orderNumber)
      return order?.userId === null && order.email === email ? memberOrder(order) : null
    },
    async listOrders(filters) {
      const term = filters.query.toLocaleLowerCase('zh-TW')
      return [...store.orders.values()]
        .filter((order) => !filters.status || order.status === filters.status)
        .filter((order) => !term || [order.orderNumber, order.recipientName, order.email]
          .some((value) => value.toLocaleLowerCase('zh-TW').includes(term)))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(ownerOrder)
    },
    async getOrder(orderNumber) {
      const order = store.orders.get(orderNumber)
      return order ? {
        ...ownerOrder(order),
        recipientPhone: order.recipientPhone,
        storeChain: order.storeChain,
        storeId: order.storeId,
        storeName: order.storeName,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        items: order.items.map(({ id, productName, sku, color, size, unitPrice, quantity }) => ({
          id, productName, sku, color, size, unitPrice, quantity,
        })),
        payment: order.payment ? { ...order.payment } : null,
      } : null
    },
    async listPaymentAttemptsRequiringReview() {
      return []
    },
    async getPaymentAttemptForReview() {
      return null
    },
    async getOrderStatus(orderId) {
      return [...store.orders.values()].find((order) => order.id === orderId)?.status ?? null
    },
    async transitionOrder(orderId, expectedStatus, nextStatus) {
      const order = [...store.orders.values()].find((candidate) => candidate.id === orderId)
      if (!order || order.status !== expectedStatus) throw new Error('order_status_changed')
      order.status = nextStatus
    },
  }
}
