import { randomUUID } from 'node:crypto'
import type { CheckoutRepository } from '@/features/checkout/service'
import { getE2EVariants, getMutableE2EProducts, E2E_STOREFRONT_SETTINGS } from '@/testing/e2e-storefront-fixtures'
import { getE2EStore, type E2EStoreState } from '@/testing/e2e-store'

type FixtureCheckoutDependencies = {
  store?: E2EStoreState
  getCurrentUserId?: () => Promise<string | null>
}

export function createFixtureCheckoutRepository(
  dependencies: FixtureCheckoutDependencies = {},
): CheckoutRepository {
  const store = dependencies.store ?? getE2EStore()

  return {
    async getCurrentUserId() {
      if (dependencies.getCurrentUserId) return dependencies.getCurrentUserId()
      const { getE2ECurrentUser } = await import('@/testing/e2e-auth-repository')
      return (await getE2ECurrentUser())?.id ?? null
    },

    async getGuestAccessToken(attemptId) {
      const { cookies } = await import('next/headers')
      return (await cookies()).get(`mori-payment-access-${attemptId}`)?.value ?? null
    },

    async setGuestAccessToken(attemptId, token) {
      const { cookies } = await import('next/headers')
      ;(await cookies()).set(`mori-payment-access-${attemptId}`, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
        maxAge: 60 * 60,
      })
    },

    async getPaymentAttemptAccess(attemptId) {
      const attempt = store.attempts.get(attemptId)
      return attempt ? {
        userId: attempt.userId,
        paymentAccessExpiresAt: attempt.paymentAccessExpiresAt,
        paymentAccessTokenHash: attempt.paymentAccessTokenHash,
      } : null
    },

    async getPaymentAttemptSummary(attemptId) {
      const attempt = store.attempts.get(attemptId)
      return attempt ? {
        items: attempt.items,
        subtotal: attempt.subtotal,
        shippingFee: attempt.shippingFee,
        total: attempt.total,
        status: attempt.status,
        email: attempt.email,
        recipientName: attempt.recipientName,
        recipientPhone: attempt.recipientPhone,
        storeChain: attempt.storeChain,
        storeId: attempt.storeId,
        storeName: attempt.storeName,
        customerNote: attempt.customerNote,
        paymentMethod: attempt.paymentMethod,
      } : null
    },

    async getVariants(variantIds) {
      return getE2EVariants(variantIds, store)
    },

    async getStoreSettings() {
      return E2E_STOREFRONT_SETTINGS
    },

    async insertPaymentAttempt(attempt) {
      const id = randomUUID()
      store.attempts.set(id, { ...attempt, id, status: 'pending', orderNumber: null })
      return { id }
    },

    async updatePaymentAttemptStatus(attemptId, status) {
      const attempt = store.attempts.get(attemptId)
      if (!attempt || (attempt.status !== 'pending' && attempt.status !== status)) {
        throw new Error('payment attempt is not pending')
      }
      attempt.status = status
    },

    async completePayment(attemptId, providerReference) {
      const attempt = store.attempts.get(attemptId)
      if (!attempt) throw new Error('payment attempt not found')
      if (attempt.status === 'paid' && attempt.orderNumber) {
        return { status: 'paid', orderNumber: attempt.orderNumber }
      }
      if (attempt.status !== 'pending') throw new Error('payment attempt is not pending')

      const products = getMutableE2EProducts(store)
      const variants = new Map(products.flatMap((product) => product.variants.map((variant) => [variant.id, { product, variant }] as const)))
      const quantities = new Map<string, number>()
      for (const item of attempt.items) {
        quantities.set(item.variant_id, (quantities.get(item.variant_id) ?? 0) + item.quantity)
      }
      for (const [variantId, quantity] of quantities) {
        const current = variants.get(variantId)
        if (!current || !store.publishedProductIds.has(current.product.id)) {
          attempt.status = 'requires_review'
          return { status: 'requires_review', reviewCode: 'catalog_changed' }
        }
        if (current.variant.stock < quantity) {
          attempt.status = 'requires_review'
          return { status: 'requires_review', reviewCode: 'stock_unavailable' }
        }
      }

      for (const [variantId, quantity] of quantities) {
        variants.get(variantId)!.variant.stock -= quantity
      }

      const orderNumber = `MORI-DEMO-${attempt.id.slice(0, 8).toUpperCase()}`
      const createdAt = new Date().toISOString()
      attempt.status = 'paid'
      attempt.orderNumber = orderNumber
      store.orders.set(orderNumber, {
        id: randomUUID(),
        orderNumber,
        userId: attempt.userId,
        email: attempt.email,
        recipientName: attempt.recipientName,
        recipientPhone: attempt.recipientPhone,
        storeChain: attempt.storeChain,
        storeId: attempt.storeId,
        storeName: attempt.storeName,
        customerNote: attempt.customerNote,
        merchantReply: '',
        paymentMethod: attempt.paymentMethod,
        subtotal: attempt.subtotal,
        shippingFee: attempt.shippingFee,
        total: attempt.total,
        status: attempt.paymentMethod === 'online_test'
          ? 'paid'
          : attempt.paymentMethod === 'convenience_cod' ? 'preparing' : 'pending_payment',
        createdAt,
        items: attempt.items.map((item) => ({
          id: randomUUID(),
          variantId: item.variant_id,
          productName: item.product_name,
          sku: item.sku,
          color: item.color,
          size: item.size,
          unitPrice: item.unit_price,
          quantity: item.quantity,
        })),
        payment: attempt.paymentMethod === 'online_test'
          ? { status: 'paid', providerReference, paidAt: createdAt }
          : { status: 'submitted', providerReference, paidAt: null },
      })
      return { status: 'paid', orderNumber }
    },

    async getCompletedOrderForAttempt(attemptId) {
      const orderNumber = store.attempts.get(attemptId)?.orderNumber
      const order = orderNumber ? store.orders.get(orderNumber) : null
      return order ? {
        orderNumber: order.orderNumber,
        email: order.email,
        storeChain: order.storeChain,
        storeId: order.storeId,
        storeName: order.storeName,
        status: order.status,
        paymentMethod: order.paymentMethod,
        total: order.total,
      } : null
    },
  }
}
