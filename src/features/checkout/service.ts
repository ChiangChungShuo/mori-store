import { createHash, timingSafeEqual } from 'node:crypto'
import { calculateCart } from '@/features/cart/totals'
import type { QuantityPriceTier } from '@/features/cart/bundle-pricing'
import { parseCartRefreshRequest } from '@/features/cart/refresh'
import { canonicalizeCartVariantId } from '@/features/cart/types'
import { parseStorefrontSettings } from '@/features/checkout/settings'
import { CheckoutAttemptError } from '@/features/checkout/types'
import { validateCoupon, type CouponValidation } from '@/features/checkout/coupons'
import type {
  CheckoutCartItem,
  CheckoutInput,
  PaymentAttemptStatus,
  PaymentAttemptSummary,
  PaymentMethod,
  PaymentResult,
  OrderSubmissionResult,
  StoreChain,
  TestPaymentOutcome,
} from '@/features/checkout/types'
import { checkoutSchema } from '@/lib/validation/checkout'
import { isE2EMode } from '@/testing/e2e-mode'
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
  imageUrl: string | null
  /** Groups variants of the same product for quantity pricing. */
  productSlug?: string
  /** The product's "buy N for NT$X" tiers, priced server-side. */
  quantityPrices?: QuantityPriceTier[]
}

export type PaymentAttemptItem = {
  variant_id: string
  quantity: number
  unit_price: number
  product_name: string
  sku: string
  color: string
  size: string
  image_url?: string | null
}

export type PaymentAttemptInsert = {
  userId: string | null
  email: string
  recipientName: string
  recipientPhone: string
  storeChain: CheckoutInput['chain']
  storeId: string
  storeName: string
  customerNote: string
  paymentMethod: PaymentMethod
  subtotal: number
  shippingFee: number
  total: number
  /** Savings from product quantity tiers, snapshotted for the order. */
  bundleDiscount: number
  /** 購物金 spent by this checkout; the ledger row is written with the order. */
  creditApplied: number
  discount: number
  couponCode: string | null
  items: PaymentAttemptItem[]
  paymentAccessExpiresAt: string
  paymentAccessTokenHash: string | null
}

type PaymentAttemptAccess = {
  userId: string | null
  paymentAccessExpiresAt: string
  paymentAccessTokenHash: string | null
}

type StoredPaymentAttemptSummary = {
  items: PaymentAttemptItem[]
  subtotal: number
  shippingFee: number
  total: number
  status: PaymentAttemptStatus
  email?: string
  recipientName?: string
  recipientPhone?: string
  customerNote?: string
  paymentMethod?: PaymentMethod
  storeChain?: StoreChain
  storeId?: string
  storeName?: string
  couponCode?: string | null
  bundleDiscount?: number
  discount?: number
  creditApplied?: number
}

export type PaymentCompletion = {
  status: 'paid'
  orderNumber: string
} | {
  status: 'requires_review'
  reviewCode: string
}

export type CompletedOrder = {
  orderNumber: string
  email: string
  /** Preserved for historical order-completion links. */
  recipientName?: string
  storeChain: StoreChain
  storeId: string
  storeName: string
  status: string
  paymentMethod?: PaymentMethod
  total?: number
}

export interface CheckoutRepository {
  getCurrentUserId(): Promise<string | null>
  getGuestAccessToken(attemptId: string): Promise<string | null>
  setGuestAccessToken(attemptId: string, token: string): Promise<void>
  getPaymentAttemptAccess(attemptId: string): Promise<PaymentAttemptAccess | null>
  getPaymentAttemptSummary(attemptId: string): Promise<StoredPaymentAttemptSummary | null>
  getVariants(variantIds: string[]): Promise<CheckoutVariant[]>
  getStoreSettings(): Promise<{ shippingFee: number; freeShippingThreshold: number | null }>
  /** 購物金 balance for the signed-in member, 0 for guests. */
  getMemberCreditBalance(userId: string): Promise<number>
  insertPaymentAttempt(attempt: PaymentAttemptInsert): Promise<{ id: string }>
  updatePaymentAttemptStatus(
    attemptId: string,
    status: 'failed' | 'cancelled',
  ): Promise<void>
  completePayment(
    attemptId: string,
    providerReference: string,
    options?: { useTestGateway?: boolean },
  ): Promise<PaymentCompletion>
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

type CouponResolver = (code: string, subtotal: number, email?: string) => Promise<CouponValidation>

const rejectCoupon: CouponResolver = async (code) => ({
  ok: false,
  code,
  discount: 0,
  message: '優惠碼無效。',
})

export function createCheckoutService(
  repository: CheckoutRepository,
  resolveCoupon: CouponResolver = rejectCoupon,
) {
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
    const userId = await repository.getCurrentUserId()
    if (!userId) throw new Error('請先登入會員再結帳')
    const requestedItems = parseCartRefreshRequest({ items: cart })
    if (!requestedItems?.length) throw new CheckoutAttemptError('cart_invalid')

    const variants = await repository.getVariants(
      requestedItems.map((item) => item.variantId),
    )
    const variantsById = new Map(variants.map((variant) => [variant.id, variant]))
    const pricedItems = requestedItems.map((item) => {
      const variant = variantsById.get(item.variantId)
      if (!variant?.isPublished) throw new CheckoutAttemptError('catalog_changed')
      if (variant.stock < item.quantity) throw new CheckoutAttemptError('stock_changed')

      return { variant, quantity: item.quantity }
    })

    const settings = await repository.getStoreSettings()
    // Tiers come from the variants the server just read, never from the client.
    const quantityTiers = new Map<string, QuantityPriceTier[]>()
    for (const { variant } of pricedItems) {
      if (variant.productSlug && variant.quantityPrices?.length) {
        quantityTiers.set(variant.productSlug, variant.quantityPrices)
      }
    }
    const totals = calculateCart(
      pricedItems.map(({ variant, quantity }) => ({
        unitPrice: variant.price,
        quantity,
        productSlug: variant.productSlug,
      })),
      settings.shippingFee,
      settings.freeShippingThreshold,
      quantityTiers,
    )
    // Coupons stack on top of the bundle price, so they discount the already
    // reduced goods total rather than the original subtotal.
    const coupon = customer.couponCode
      ? await resolveCoupon(customer.couponCode, totals.discountedSubtotal, customer.email)
      : null
    if (coupon && !coupon.ok) throw new CheckoutAttemptError('coupon_invalid')
    const guestToken = null
    // 購物金 comes off the payable total automatically — members never type a code.
    const payableAfterCoupon = Math.max(0, totals.total - (coupon?.discount ?? 0))
    const creditBalance = await repository.getMemberCreditBalance(userId)
    const creditApplied = Math.max(0, Math.min(creditBalance, payableAfterCoupon))
    const attempt = await repository.insertPaymentAttempt({
      userId,
      email: customer.email,
      recipientName: customer.recipientName,
      recipientPhone: customer.phone,
      storeChain: customer.chain,
      storeId: customer.storeId,
      storeName: customer.storeName,
      customerNote: customer.customerNote ?? '',
      paymentMethod: customer.paymentMethod ?? 'bank_transfer',
      subtotal: totals.subtotal,
      shippingFee: totals.shipping,
      total: payableAfterCoupon - creditApplied,
      bundleDiscount: totals.bundleDiscount,
      creditApplied,
      discount: coupon?.ok ? coupon.discount : 0,
      couponCode: coupon?.ok ? coupon.code : null,
      items: pricedItems.map(({ variant, quantity }) => ({
        variant_id: variant.id,
        quantity,
        unit_price: variant.price,
        product_name: variant.productName,
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
        image_url: variant.imageUrl,
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

    const completion = await repository.completePayment(
      canonicalAttemptId,
      createTestProviderReference(canonicalAttemptId),
      { useTestGateway: true },
    )
    if (completion.status === 'requires_review') {
      return {
        outcome: 'requires_review',
        reviewCode: completion.reviewCode,
        message: '付款結果需人工確認，商品資料或庫存已變更。',
      }
    }
    return {
      outcome,
      orderNumber: completion.orderNumber,
      redirectUrl: `/order-complete/${completion.orderNumber}?attemptId=${canonicalAttemptId}`,
    }
  }

  async function submitOrder(attemptId: string): Promise<OrderSubmissionResult> {
    const canonicalAttemptId = await authorizePaymentAttempt(attemptId)
    const attempt = await repository.getPaymentAttemptSummary(canonicalAttemptId)
    if (!attempt) throw new Error('無權存取付款交易')

    const completion = await repository.completePayment(
      canonicalAttemptId,
      `manual-order:${canonicalAttemptId}`,
    )
    if (completion.status === 'requires_review') {
      throw new CheckoutAttemptError(
        completion.reviewCode === 'stock_unavailable' ? 'stock_changed' : 'catalog_changed',
      )
    }

    // Record coupon usage so "once overall" / "once per account" limits hold.
    if (attempt.couponCode && attempt.email) {
      const { recordCouponRedemption } = await import('@/features/checkout/coupons')
      await recordCouponRedemption(attempt.couponCode, attempt.email, completion.orderNumber)
    }

    // Fire-and-forget order confirmation email. Never let a mail failure roll
    // back an order that already completed. Skips entirely without an API key,
    // so tests and unconfigured environments have no side effects.
    if (attempt.email && process.env.RESEND_API_KEY) {
      try {
        const { sendOrderConfirmationEmail } = await import('@/lib/email/order-confirmation')
        await sendOrderConfirmationEmail({
          orderNumber: completion.orderNumber,
          email: attempt.email,
          recipientName: attempt.recipientName,
          items: attempt.items.map((item) => ({
            productName: item.product_name,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            unitPrice: item.unit_price,
          })),
          subtotal: attempt.subtotal,
          shippingFee: attempt.shippingFee,
          total: attempt.total,
          storeChain: attempt.storeChain,
          storeName: attempt.storeName,
          storeId: attempt.storeId,
          paymentMethod: attempt.paymentMethod,
        })
      } catch (error) {
        console.error('[email] order confirmation failed', error)
      }
    }

    return {
      outcome: 'submitted',
      orderNumber: completion.orderNumber,
      redirectUrl: `/order-complete/${completion.orderNumber}?attemptId=${canonicalAttemptId}`,
    }
  }

  async function getAuthorizedPaymentAttempt(attemptId: string) {
    const canonicalAttemptId = await authorizePaymentAttempt(attemptId)
    const attempt = await repository.getPaymentAttemptSummary(canonicalAttemptId)
    if (!attempt) throw new Error('無權存取付款交易')
    return {
      ...attempt,
      items: attempt.items.map((item) => ({
        variantId: item.variant_id,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        productName: item.product_name,
        sku: item.sku,
        color: item.color,
        size: item.size,
        imageUrl: item.image_url ?? null,
      })),
    } as PaymentAttemptSummary
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
    submitOrder,
    getAuthorizedPaymentAttempt,
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

    async getPaymentAttemptSummary(attemptId) {
      const baseColumns = 'items, subtotal, shipping_fee, total, status, email, recipient_name, recipient_phone, store_chain, store_id, store_name, customer_note, payment_method, coupon_code, discount, credit_applied'
      let { data, error } = await admin
        .from('payment_attempts')
        .select(`${baseColumns}, bundle_discount`)
        .eq('id', attemptId)
        .maybeSingle()
      if (error) {
        // Retry without bundle_discount so orders still load before the
        // quantity-pricing migration has been applied.
        const fallback = await admin
          .from('payment_attempts')
          .select(baseColumns)
          .eq('id', attemptId)
          .maybeSingle()
        data = fallback.data as typeof data
        error = fallback.error
      }
      if (error) throw error
      if (!data || !Array.isArray(data.items)) return null

      const items = data.items.flatMap((value): PaymentAttemptItem[] => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return []
        const item = value as Record<string, unknown>
        if (typeof item.variant_id !== 'string'
          || !Number.isInteger(item.quantity)
          || !Number.isInteger(item.unit_price)
          || typeof item.product_name !== 'string'
          || typeof item.sku !== 'string'
          || typeof item.color !== 'string'
          || typeof item.size !== 'string') return []
        return [item as PaymentAttemptItem]
      })
      if (items.length !== data.items.length) throw new Error('付款交易資料無效')
      return {
        items,
        subtotal: data.subtotal,
        shippingFee: data.shipping_fee,
        total: data.total,
        status: data.status,
        email: data.email,
        recipientName: data.recipient_name,
        recipientPhone: data.recipient_phone,
        storeChain: data.store_chain,
        storeId: data.store_id,
        storeName: data.store_name,
        customerNote: data.customer_note,
        paymentMethod: data.payment_method as PaymentMethod,
        couponCode: data.coupon_code,
        bundleDiscount: 'bundle_discount' in data ? data.bundle_discount ?? 0 : 0,
        discount: data.discount ?? 0,
        creditApplied: 'credit_applied' in data ? data.credit_applied ?? 0 : 0,
      }
    },

    async getVariants(variantIds) {
      const { data, error } = await admin
        .from('product_variants')
        .select('id, sku, color, size, price, stock, products!inner(name, slug, is_published, available_at, product_images(storage_path, position))')
        .in('id', variantIds)
        .eq('is_active', true)
      if (error) throw error

      // Tiers are read separately, and failures are swallowed, so checkout keeps
      // working whether or not the quantity-pricing migration has been applied.
      const tiersBySlug = new Map<string, Array<{ quantity: number; bundlePrice: number }>>()
      try {
        const { data: tierRows, error: tierError } = await admin
          .from('product_quantity_prices')
          .select('quantity, bundle_price, products!inner(slug)')
        if (tierError) throw tierError
        for (const row of (tierRows ?? []) as unknown as Array<{
          quantity: number
          bundle_price: number
          products: { slug: string }
        }>) {
          const tiers = tiersBySlug.get(row.products.slug) ?? []
          tiers.push({ quantity: row.quantity, bundlePrice: row.bundle_price })
          tiersBySlug.set(row.products.slug, tiers)
        }
      } catch {
        tiersBySlug.clear()
      }

      return (data ?? []).map((variant) => {
        const product = variant.products as unknown as {
          name: string
          slug: string
          is_published: boolean
          available_at: string | null
          product_images: Array<{ storage_path: string; position: number }>
        }
        const primaryImage = [...product.product_images].sort((a, b) => a.position - b.position)[0]
        return {
          id: variant.id,
          productName: product.name,
          productSlug: product.slug,
          quantityPrices: tiersBySlug.get(product.slug) ?? [],
          sku: variant.sku,
          color: variant.color,
          size: variant.size,
          price: variant.price,
          stock: variant.stock,
          isPublished: product.is_published && (!product.available_at || new Date(product.available_at) <= new Date()),
          imageUrl: primaryImage
            ? admin.storage.from('product-images').getPublicUrl(primaryImage.storage_path).data.publicUrl
            : null,
        }
      })
    },

    async getStoreSettings() {
      const { data, error } = await admin
        .from('store_settings')
        .select('key, value')
        .in('key', ['shipping_fee', 'free_shipping_threshold'])
      if (error) throw error

      return parseStorefrontSettings(data ?? [])
    },

    async getMemberCreditBalance(userId) {
      const { getMemberCreditBalance } = await import('@/features/account/member-credit')
      return getMemberCreditBalance(userId)
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
        customer_note: attempt.customerNote,
        payment_method: attempt.paymentMethod,
        subtotal: attempt.subtotal,
        shipping_fee: attempt.shippingFee,
        total: attempt.total,
        discount: attempt.discount,
        coupon_code: attempt.couponCode,
        // Only sent when non-zero, which can only happen once the
        // quantity-pricing migration has added the column.
        ...(attempt.bundleDiscount > 0 ? { bundle_discount: attempt.bundleDiscount } : {}),
        ...(attempt.creditApplied > 0 ? { credit_applied: attempt.creditApplied } : {}),
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

    async completePayment(attemptId, providerReference, options) {
      // Manual fulfilment is the only flow this shop runs. The test gateway
      // marks an order paid without any money arriving, so against the real
      // database it is refused outright rather than merely unused.
      if (options?.useTestGateway) throw new Error('測試付款流程未啟用')
      const rpc = 'finalize_manual_order'
      const { data, error } = await admin.rpc(rpc, {
        payment_attempt_id: attemptId,
        provider_reference: providerReference,
      })
      if (error) throw error
      if (data.status === 'requires_review') {
        return {
          status: 'requires_review',
          reviewCode: data.review_code ?? 'payment_review_required',
        }
      }
      if (data.status !== 'paid' || !data.order_number) {
        throw new Error('付款交易結果無效')
      }
      return { status: 'paid', orderNumber: data.order_number }
    },

    async getCompletedOrderForAttempt(attemptId) {
      const { data, error } = await admin
        .from('payment_attempts')
        .select(`
          orders!inner(order_number, email, recipient_name, store_chain, store_id, store_name, status, payment_method, total)
        `)
        .eq('id', attemptId)
        .maybeSingle()
      if (error) throw error
      if (!data) return null

      const order = data.orders as unknown as {
        order_number: string
        email: string
        recipient_name: string | null
        store_chain: CheckoutInput['chain']
        store_id: string
        store_name: string
        status: string
        payment_method: PaymentMethod
        total: number
      }
      return {
        orderNumber: order.order_number,
        recipientName: order.recipient_name ?? undefined,
        email: order.email,
        storeChain: order.store_chain,
        storeId: order.store_id,
        storeName: order.store_name,
        status: order.status,
        paymentMethod: order.payment_method,
        total: order.total,
      }
    },
  }
}

async function createCheckoutRepository() {
  if (isE2EMode()) {
    const [{ createFixtureCheckoutRepository }, { getE2ECurrentUser }] = await Promise.all([
      import('@/testing/e2e-checkout-repository'),
      import('@/testing/e2e-auth-repository'),
    ])
    return {
      ...createFixtureCheckoutRepository(),
      async getCurrentUserId() {
        return (await getE2ECurrentUser())?.id ?? null
      },
    }
  }
  return createLiveRepository()
}

export async function createPaymentAttempt(input: CheckoutInput, cart: CheckoutCartItem[]) {
  return createCheckoutService(await createCheckoutRepository(), validateCoupon)
    .createPaymentAttempt(input, cart)
}

export async function completeTestPayment(
  attemptId: string,
  outcome: TestPaymentOutcome,
) {
  return createCheckoutService(await createCheckoutRepository())
    .completeTestPayment(attemptId, outcome)
}

export async function submitOrder(attemptId: string) {
  return createCheckoutService(await createCheckoutRepository()).submitOrder(attemptId)
}

export async function authorizePaymentAttempt(attemptId: string) {
  return createCheckoutService(await createCheckoutRepository())
    .authorizePaymentAttempt(attemptId)
}

export async function getAuthorizedPaymentAttempt(attemptId: string) {
  return createCheckoutService(await createCheckoutRepository())
    .getAuthorizedPaymentAttempt(attemptId)
}

export async function getAuthorizedCompletedOrder(
  attemptId: string,
  orderNumber: string,
) {
  return createCheckoutService(await createCheckoutRepository())
    .getAuthorizedCompletedOrder(attemptId, orderNumber)
}
