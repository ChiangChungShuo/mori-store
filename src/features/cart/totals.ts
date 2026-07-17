type PricedCartItem = Pick<
  import('@/features/cart/types').CartItem,
  'unitPrice' | 'quantity'
>

export function calculateCart(
  items: PricedCartItem[],
  shippingFee: number,
  freeShippingThreshold: number,
) {
  const subtotal = items.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  )
  const shipping = subtotal === 0 || subtotal >= freeShippingThreshold ? 0 : shippingFee

  return { subtotal, shipping, total: subtotal + shipping }
}
