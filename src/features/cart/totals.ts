import {
  calculateBundleDiscounts,
  type CartBundlePricing,
  type QuantityPriceTier,
} from '@/features/cart/bundle-pricing'

type PricedCartItem = Pick<
  import('@/features/cart/types').CartItem,
  'unitPrice' | 'quantity'
> & {
  /** Groups cart lines that share quantity tiers. Absent = no tiers apply. */
  productSlug?: string
}

export type CartTotals = {
  /** Sum of unit prices, before any discount. */
  subtotal: number
  /** Savings from product quantity tiers. */
  bundleDiscount: number
  /** subtotal - bundleDiscount; the free-shipping threshold is judged on this. */
  discountedSubtotal: number
  shipping: number
  total: number
  bundles: CartBundlePricing['byProduct']
}

const NO_TIERS: Record<string, QuantityPriceTier[]> = {}

export function calculateCart(
  items: PricedCartItem[],
  shippingFee: number,
  freeShippingThreshold: number | null,
  quantityTiers: Record<string, QuantityPriceTier[]> | Map<string, QuantityPriceTier[]> = NO_TIERS,
): CartTotals {
  const subtotal = items.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  )

  const bundles = calculateBundleDiscounts(
    items.flatMap((item) => item.productSlug
      ? [{ productKey: item.productSlug, unitPrice: item.unitPrice, quantity: item.quantity }]
      : []),
    quantityTiers,
  )
  const bundleDiscount = Math.min(bundles.discount, subtotal)
  const discountedSubtotal = subtotal - bundleDiscount

  // Free shipping is judged on what the shopper actually pays for goods, so a
  // bundle discount can push an order back under the threshold.
  const hasFreeShipping = freeShippingThreshold !== null && discountedSubtotal >= freeShippingThreshold
  const shipping = subtotal === 0 || hasFreeShipping ? 0 : shippingFee

  return {
    subtotal,
    bundleDiscount,
    discountedSubtotal,
    shipping,
    total: discountedSubtotal + shipping,
    bundles: bundles.byProduct,
  }
}
