import 'server-only'

import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import type {
  CheckoutRepository,
  CompletedOrder,
  PaymentAttemptInsert,
} from '@/features/checkout/service'
import type { PaymentAttemptStatus } from '@/features/checkout/types'
import { getE2EVariants, E2E_STOREFRONT_SETTINGS } from '@/testing/e2e-storefront-fixtures'

type FixtureAttempt = PaymentAttemptInsert & {
  id: string
  status: PaymentAttemptStatus
  order: CompletedOrder | null
}

type FixtureCheckoutState = {
  attempts: Map<string, FixtureAttempt>
}

const fixtureGlobal = globalThis as typeof globalThis & {
  __moriFixtureCheckout?: FixtureCheckoutState
}

function getFixtureState() {
  fixtureGlobal.__moriFixtureCheckout ??= { attempts: new Map() }
  return fixtureGlobal.__moriFixtureCheckout
}

export function createFixtureCheckoutRepository(): CheckoutRepository {
  const state = getFixtureState()

  return {
    async getCurrentUserId() {
      return null
    },

    async getGuestAccessToken(attemptId) {
      return (await cookies()).get(`mori-payment-access-${attemptId}`)?.value ?? null
    },

    async setGuestAccessToken(attemptId, token) {
      ;(await cookies()).set(`mori-payment-access-${attemptId}`, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
        maxAge: 60 * 60,
      })
    },

    async getPaymentAttemptAccess(attemptId) {
      const attempt = state.attempts.get(attemptId)
      return attempt ? {
        userId: attempt.userId,
        paymentAccessExpiresAt: attempt.paymentAccessExpiresAt,
        paymentAccessTokenHash: attempt.paymentAccessTokenHash,
      } : null
    },

    async getPaymentAttemptSummary(attemptId) {
      const attempt = state.attempts.get(attemptId)
      return attempt ? {
        items: attempt.items,
        subtotal: attempt.subtotal,
        shippingFee: attempt.shippingFee,
        total: attempt.total,
        status: attempt.status,
      } : null
    },

    async getVariants(variantIds) {
      return getE2EVariants(variantIds)
    },

    async getStoreSettings() {
      return E2E_STOREFRONT_SETTINGS
    },

    async insertPaymentAttempt(attempt) {
      const id = randomUUID()
      state.attempts.set(id, { ...attempt, id, status: 'pending', order: null })
      return { id }
    },

    async updatePaymentAttemptStatus(attemptId, status) {
      const attempt = state.attempts.get(attemptId)
      if (!attempt || (attempt.status !== 'pending' && attempt.status !== status)) {
        throw new Error('payment attempt is not pending')
      }
      attempt.status = status
    },

    async completePayment(attemptId) {
      const attempt = state.attempts.get(attemptId)
      if (!attempt) throw new Error('payment attempt not found')
      if (attempt.status === 'paid' && attempt.order) {
        return { status: 'paid', orderNumber: attempt.order.orderNumber }
      }
      if (attempt.status !== 'pending') throw new Error('payment attempt is not pending')

      const orderNumber = `MORI-DEMO-${attempt.id.slice(0, 8).toUpperCase()}`
      attempt.status = 'paid'
      attempt.order = {
        orderNumber,
        storeChain: attempt.storeChain,
        storeId: attempt.storeId,
        storeName: attempt.storeName,
        status: 'paid',
      }
      return { status: 'paid', orderNumber }
    },

    async getCompletedOrderForAttempt(attemptId) {
      return state.attempts.get(attemptId)?.order ?? null
    },
  }
}
