import { calculateCart } from '@/features/cart/totals'
import { parseCartRefreshRequest } from '@/features/cart/refresh'
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
}

export interface CheckoutRepository {
  getCurrentUserId(): Promise<string | null>
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
}

export function createTestProviderReference(attemptId: string) {
  return `test-payment:${attemptId}`
}

export function createCheckoutService(repository: CheckoutRepository) {
  async function createPaymentAttempt(input: CheckoutInput, cart: CheckoutCartItem[]) {
    const customer = checkoutSchema.parse(input)
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
    const attempt = await repository.insertPaymentAttempt({
      userId,
      email: customer.email,
      recipientName: customer.recipientName,
      recipientPhone: customer.phone,
      storeChain: customer.chain,
      storeId: customer.storeId,
      storeName: customer.storeName,
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
    })

    return { attemptId: attempt.id }
  }

  async function completeTestPayment(
    attemptId: string,
    outcome: TestPaymentOutcome,
  ): Promise<PaymentResult> {
    if (outcome !== 'success') {
      const status = outcome === 'failure' ? 'failed' : 'cancelled'
      await repository.updatePaymentAttemptStatus(attemptId, status)
      return { outcome, redirectUrl: `/checkout?payment=${outcome}` }
    }

    const order = await repository.completePayment(
      attemptId,
      createTestProviderReference(attemptId),
    )
    return {
      outcome,
      orderNumber: order.orderNumber,
      redirectUrl: `/order-complete/${order.orderNumber}`,
    }
  }

  return { createPaymentAttempt, completeTestPayment }
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

    async getVariants(variantIds) {
      const { data, error } = await admin
        .from('product_variants')
        .select('id, sku, color, size, price, stock, products!inner(name, is_published)')
        .in('id', variantIds)
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

export async function getCompletedOrder(orderNumber: string) {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('orders')
    .select('order_number, store_chain, store_id, store_name, status')
    .eq('order_number', orderNumber)
    .maybeSingle()
  if (error) throw error
  return data
}
