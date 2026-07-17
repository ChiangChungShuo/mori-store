import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { calculateCart } from '@/features/cart/totals'
import { parseCartRefreshRequest } from '@/features/cart/refresh'
import { canonicalizeCartVariantId } from '@/features/cart/types'
import { findTestStore } from '@/features/checkout/stores'
import type {
  CheckoutCartItem,
  CheckoutInput,
  PaymentResult,
  TestPaymentOutcome,
} from '@/features/checkout/types'
import { checkoutSchema } from '@/lib/validation/checkout'
import type { Json, TablesInsert } from '@/types/database'

export type CheckoutVariant = {
  id: string
  productName: string
  sku: string
  color: string
  size: string
  price: number
  stock: number
  isPublished: boolean
}

export type PaymentAttemptItem = {
  variant_id: string
  quantity: number
  unit_price: number
  product_name: string
  sku: string
  color: string
  size: string
}

export type PaymentAttemptInsert = {
  userId: string | null
  email: string
  recipientName: string
  recipientPhone: string
  storeChain: CheckoutInput['chain']
  storeId: string
  storeName: string
  subtotal: number
  shippingFee: number
  total: number
  items: PaymentAttemptItem[]
  paymentAccessExpiresAt: string
  paymentAccessTokenHash: string | null
}

type PaymentAttemptAccess = {
  userId: string | null
  paymentAccessExpiresAt: string
  paymentAccessTokenHash: string | null
}

export type CompletedOrder = {
  orderNumber: string
  storeChain: CheckoutInput['chain']
  storeId: string
  storeName: string
  status: string
}

export interface CheckoutRepository {
  getCurrentUserId(): Promise<string | null>
  getGuestAccessToken(attemptId: string): Promise<string | null>
  setGuestAccessToken(attemptId: string, token: string): Promise<void>
  getPaymentAttemptAccess(attemptId: string): Promise<PaymentAttemptAccess | null>
  getVariants(variantIds: string[]): Promise<CheckoutVariant[]>
  getStoreSettings(): Promise<{ shippingFee: number; freeShippingThreshold: number }>
  insertPaymentAttempt(attempt: PaymentAttemptInsert): Promise<{ id: string }>
  updatePaymentAttemptStatus(
    attemptId: string,
    status: 'failed' | 'cancelled',
  ): Promise<void>
  completePayment(
    attemptId: string,
    providerReference: string,
  ): Promise<{ orderNumber: string }>
  getCompletedOrderForAttempt(attemptId: string): Promise<CompletedOrder | null>
}

function canonicalizePaymentAttemptId(attemptId: string) {
  const canonical = canonicalizeCartVariantId(attemptId)
  if (!canonical) throw new Error('付款交易編號無效')
  return canonical
}

function hashPaymentAccessToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function tokenHashMatches(actual: string | null, expected: string) {
  if (!actual || !/^[0-9a-f]{64}$/.test(actual)) return false
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))
}

export function createTestProviderReference(attemptId: string) {
  return `test-payment:${canonicalizePaymentAttemptId(attemptId)}`
}

export function createCheckoutService(repository: CheckoutRepository) {
  async function authorizePaymentAttempt(attemptIdInput: string) {
    const attemptId = canonicalizePaymentAttemptId(attemptIdInput)
    const attempt = await repository.getPaymentAttemptAccess(attemptId)
    if (!attempt) throw new Error('無權存取付款交易')

    if (attempt.userId) {
      const userId = await repository.getCurrentUserId()
      if (userId !== attempt.userId) throw new Error('無權存取付款交易')
      return attemptId
    }

    const expiresAt = Date.parse(attempt.paymentAccessExpiresAt)
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new Error('無權存取付款交易')
    }

    const token = await repository.getGuestAccessToken(attemptId)
    if (!token || !tokenHashMatches(
      attempt.paymentAccessTokenHash,
      hashPaymentAccessToken(token),
    )) {
      throw new Error('無權存取付款交易')
    }

    return attemptId
  }

  async function createPaymentAttempt(input: CheckoutInput, cart: CheckoutCartItem[]) {
    const customer = checkoutSchema.parse(input)
    const store = findTestStore(customer.chain, customer.storeId)
    if (!store) throw new Error('不支援的取貨門市')
    const requestedItems = parseCartRefreshRequest({ items: cart })
    if (!requestedItems?.length) throw new Error('購物袋內容無效')

    const variants = await repository.getVariants(
      requestedItems.map((item) => item.variantId),
    )
    const variantsById = new Map(variants.map((variant) => [variant.id, variant]))
    const pricedItems = requestedItems.map((item) => {
      const variant = variantsById.get(item.variantId)
      if (!variant?.isPublished) throw new Error('商品已下架或不存在')
      if (variant.stock < item.quantity) throw new Error('商品庫存不足')

      return { variant, quantity: item.quantity }
    })

    const settings = await repository.getStoreSettings()
    const totals = calculateCart(
      pricedItems.map(({ variant, quantity }) => ({ unitPrice: variant.price, quantity })),
      settings.shippingFee,
      settings.freeShippingThreshold,
    )
    const userId = await repository.getCurrentUserId()
    const guestToken = userId ? null : randomBytes(32).toString('base64url')
    const attempt = await repository.insertPaymentAttempt({
      userId,
      email: customer.email,
      recipientName: customer.recipientName,
      recipientPhone: customer.phone,
      storeChain: customer.chain,
      storeId: customer.storeId,
      storeName: store.storeName,
      subtotal: totals.subtotal,
      shippingFee: totals.shipping,
      total: totals.total,
      items: pricedItems.map(({ variant, quantity }) => ({
        variant_id: variant.id,
        quantity,
        unit_price: variant.price,
        product_name: variant.productName,
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
      })),
      paymentAccessExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      paymentAccessTokenHash: guestToken ? hashPaymentAccessToken(guestToken) : null,
    })
    if (guestToken) await repository.setGuestAccessToken(attempt.id, guestToken)

    return { attemptId: attempt.id }
  }

  async function completeTestPayment(
    attemptId: string,
    outcome: TestPaymentOutcome,
  ): Promise<PaymentResult> {
    const canonicalAttemptId = await authorizePaymentAttempt(attemptId)
    if (outcome !== 'success') {
      const status = outcome === 'failure' ? 'failed' : 'cancelled'
      await repository.updatePaymentAttemptStatus(canonicalAttemptId, status)
      return { outcome, redirectUrl: `/checkout?payment=${outcome}` }
    }

    const order = await repository.completePayment(
      canonicalAttemptId,
      createTestProviderReference(canonicalAttemptId),
    )
    return {
      outcome,
      orderNumber: order.orderNumber,
      redirectUrl: `/order-complete/${order.orderNumber}?attemptId=${canonicalAttemptId}`,
    }
  }

  async function getAuthorizedCompletedOrder(attemptId: string, orderNumber: string) {
    const canonicalAttemptId = await authorizePaymentAttempt(attemptId)
    const order = await repository.getCompletedOrderForAttempt(canonicalAttemptId)
    return order?.orderNumber === orderNumber ? order : null
  }

  return {
    authorizePaymentAttempt,
    createPaymentAttempt,
    completeTestPayment,
    getAuthorizedCompletedOrder,
  }
}

async function createLiveRepository(): Promise<CheckoutRepository> {
  const [{ createAdminClient }, { createClient }] = await Promise.all([
    import('@/lib/supabase/admin'),
    import('@/lib/supabase/server'),
  ])
  const admin = createAdminClient()

  return {
    async getCurrentUserId() {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.getUser()
      if (error) return null
      return data.user?.id ?? null
    },

    async getGuestAccessToken(attemptId) {
      const { cookies } = await import('next/headers')
      return (await cookies()).get(`mori-payment-access-${attemptId}`)?.value ?? null
    },

    async setGuestAccessToken(attemptId, token) {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      cookieStore.set(`mori-payment-access-${attemptId}`, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60,
      })
    },

    async getPaymentAttemptAccess(attemptId) {
      const { data, error } = await admin
        .from('payment_attempts')
        .select('user_id, payment_access_expires_at, payment_access_token_hash')
        .eq('id', attemptId)
        .maybeSingle()
      if (error) throw error
      return data ? {
        userId: data.user_id,
        paymentAccessExpiresAt: data.payment_access_expires_at,
        paymentAccessTokenHash: data.payment_access_token_hash,
      } : null
    },

    async getVariants(variantIds) {
      const { data, error } = await admin
        .from('product_variants')
        .select('id, sku, color, size, price, stock, products!inner(name, is_published)')
        .in('id', variantIds)
        .eq('is_active', true)
      if (error) throw error

      return (data ?? []).map((variant) => {
        const product = variant.products as unknown as { name: string; is_published: boolean }
        return {
          id: variant.id,
          productName: product.name,
          sku: variant.sku,
          color: variant.color,
          size: variant.size,
          price: variant.price,
          stock: variant.stock,
          isPublished: product.is_published,
        }
      })
    },

    async getStoreSettings() {
      const { data, error } = await admin
        .from('store_settings')
        .select('key, value')
        .in('key', ['shipping_fee', 'free_shipping_threshold'])
      if (error) throw error

      const settings = new Map((data ?? []).map((setting) => [setting.key, setting.value]))
      const amount = (key: string, fallback: number) => {
        const value = settings.get(key)
        if (!value || Array.isArray(value) || typeof value !== 'object') return fallback
        const candidate = (value as { amount?: unknown }).amount
        return typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= 0
          ? candidate
          : fallback
      }

      return {
        shippingFee: amount('shipping_fee', 60),
        freeShippingThreshold: amount('free_shipping_threshold', 1500),
      }
    },

    async insertPaymentAttempt(attempt) {
      const row: TablesInsert<'payment_attempts'> = {
        user_id: attempt.userId,
        email: attempt.email,
        recipient_name: attempt.recipientName,
        recipient_phone: attempt.recipientPhone,
        store_chain: attempt.storeChain,
        store_id: attempt.storeId,
        store_name: attempt.storeName,
        subtotal: attempt.subtotal,
        shipping_fee: attempt.shippingFee,
        total: attempt.total,
        items: attempt.items as unknown as Json,
        payment_access_expires_at: attempt.paymentAccessExpiresAt,
        payment_access_token_hash: attempt.paymentAccessTokenHash,
      }
      const { data, error } = await admin
        .from('payment_attempts')
        .insert(row)
        .select('id')
        .single()
      if (error) throw error
      return data
    },

    async updatePaymentAttemptStatus(attemptId, status) {
      const { data, error } = await admin
        .from('payment_attempts')
        .update({ status })
        .eq('id', attemptId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (data) return

      const current = await admin
        .from('payment_attempts')
        .select('status')
        .eq('id', attemptId)
        .maybeSingle()
      if (current.error) throw current.error
      if (current.data?.status !== status) throw new Error('payment attempt is not pending')
    },

    async completePayment(attemptId, providerReference) {
      const { data, error } = await admin.rpc('complete_test_payment', {
        payment_attempt_id: attemptId,
        provider_reference: providerReference,
      })
      if (error) throw error
      return { orderNumber: data.order_number }
    },

    async getCompletedOrderForAttempt(attemptId) {
      const { data, error } = await admin
        .from('payment_attempts')
        .select(`
          orders!inner(order_number, store_chain, store_id, store_name, status)
        `)
        .eq('id', attemptId)
        .maybeSingle()
      if (error) throw error
      if (!data) return null

      const order = data.orders as unknown as {
        order_number: string
        store_chain: CheckoutInput['chain']
        store_id: string
        store_name: string
        status: string
      }
      return {
        orderNumber: order.order_number,
        storeChain: order.store_chain,
        storeId: order.store_id,
        storeName: order.store_name,
        status: order.status,
      }
    },
  }
}

export async function createPaymentAttempt(input: CheckoutInput, cart: CheckoutCartItem[]) {
  return createCheckoutService(await createLiveRepository()).createPaymentAttempt(input, cart)
}

export async function completeTestPayment(
  attemptId: string,
  outcome: TestPaymentOutcome,
) {
  return createCheckoutService(await createLiveRepository())
    .completeTestPayment(attemptId, outcome)
}

export async function authorizePaymentAttempt(attemptId: string) {
  return createCheckoutService(await createLiveRepository())
    .authorizePaymentAttempt(attemptId)
}

export async function getAuthorizedCompletedOrder(
  attemptId: string,
  orderNumber: string,
) {
  return createCheckoutService(await createLiveRepository())
    .getAuthorizedCompletedOrder(attemptId, orderNumber)
}
