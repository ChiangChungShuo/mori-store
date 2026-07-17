import type { CheckoutInput } from '@/lib/validation/checkout'

export type { CheckoutInput }

export type CheckoutCartItem = {
  variantId: string
  quantity: number
}

export type StoreChain = CheckoutInput['chain']

export type TestStore = {
  chain: StoreChain
  storeId: string
  storeName: string
  address: string
}

export type TestPaymentOutcome = 'success' | 'failure' | 'cancelled'

export type PaymentResult = {
  outcome: TestPaymentOutcome
  redirectUrl: string
  orderNumber?: string
}
