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

export type CheckoutAttemptErrorCode = 'cart_invalid' | 'catalog_changed' | 'stock_changed'

export class CheckoutAttemptError extends Error {
  constructor(readonly code: CheckoutAttemptErrorCode) {
    super({
      cart_invalid: '購物袋內容無效',
      catalog_changed: '商品已下架或不存在',
      stock_changed: '商品庫存不足',
    }[code])
    this.name = 'CheckoutAttemptError'
  }
}

export function toCheckoutActionState(error: unknown): CheckoutActionState {
  if (error instanceof CheckoutAttemptError) {
    return {
      status: 'error',
      message: '商品資料或庫存已變更，請更新購物袋後再試一次。',
      refreshCart: true,
    }
  }
  return {
    status: 'error',
    message: '目前無法建立付款交易，請稍後再試。',
    refreshCart: false,
  }
}

export type StoreChain = CheckoutInput['chain']

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
  }>
  subtotal: number
  shippingFee: number
  total: number
  status: PaymentAttemptStatus
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
