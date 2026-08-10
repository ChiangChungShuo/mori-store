import type { CheckoutInput } from '@/lib/validation/checkout'

export type { CheckoutInput }

export type CheckoutCartItem = {
  variantId: string
  quantity: number
}

export type CheckoutActionState = {
  status: 'idle' | 'error'
  message?: string
  refreshCart?: boolean
}

export type CheckoutAttemptErrorCode = 'cart_invalid' | 'catalog_changed' | 'stock_changed' | 'coupon_invalid'

export class CheckoutAttemptError extends Error {
  constructor(readonly code: CheckoutAttemptErrorCode) {
    super({
      cart_invalid: '購物車內容無效',
      catalog_changed: '商品已下架或不存在',
      stock_changed: '商品庫存不足',
      coupon_invalid: '優惠碼已失效或不符合使用條件',
    }[code])
    this.name = 'CheckoutAttemptError'
  }
}

export function toCheckoutActionState(error: unknown): CheckoutActionState {
  if (error instanceof CheckoutAttemptError) {
    if (error.code === 'coupon_invalid') {
      return {
        status: 'error',
        message: '優惠碼已失效或不符合使用條件，請重新套用。',
        refreshCart: false,
      }
    }
    return {
      status: 'error',
      message: '商品資料或庫存已變更，請更新購物車後再試一次。',
      refreshCart: true,
    }
  }
  return {
    status: 'error',
    message: '目前無法建立付款交易，請稍後再試。',
    refreshCart: false,
  }
}

// Existing orders may still contain FamilyMart pickup data even though new
// checkout attempts are restricted to 7-ELEVEN.
export type StoreChain = 'seven_eleven' | 'family_mart'
export type PaymentMethod = Exclude<CheckoutInput['paymentMethod'], undefined>

export type TestStore = {
  chain: StoreChain
  storeId: string
  storeName: string
  address: string
}

export type TestPaymentOutcome = 'success' | 'failure' | 'cancelled'

export type PaymentAttemptStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'requires_review'

export type PaymentAttemptSummary = {
  items: Array<{
    variantId: string
    quantity: number
    unitPrice: number
    productName: string
    sku: string
    color: string
    size: string
    imageUrl: string | null
  }>
  subtotal: number
  shippingFee: number
  total: number
  /** 購物金 spent on this order, shown as its own line. */
  creditApplied?: number
  status: PaymentAttemptStatus
  email: string
  recipientName: string
  recipientPhone: string
  customerNote: string
  paymentMethod: PaymentMethod
  storeChain?: StoreChain
  storeId?: string
  storeName?: string
}

export type OrderSubmissionResult = {
  outcome: 'submitted'
  redirectUrl: string
  orderNumber: string
}

export type PaymentResult = {
  outcome: TestPaymentOutcome
  redirectUrl: string
  orderNumber?: string
} | {
  outcome: 'requires_review'
  reviewCode: string
  message: string
}
