export type CartItem = {
  variantId: string
  productSlug: string
  name: string
  imageUrl: string | null
  color: string
  size: string
  unitPrice: number
  quantity: number
  maxStock: number
}

export const MAX_CART_ITEM_QUANTITY = 99

export function getCartQuantityLimit(maxStock: number) {
  if (!Number.isFinite(maxStock)) return 0
  return Math.min(Math.max(0, Math.floor(maxStock)), MAX_CART_ITEM_QUANTITY)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export function isCartItem(item: unknown): item is CartItem {
  if (!item || typeof item !== 'object') return false

  const candidate = item as Record<string, unknown>
  return isNonEmptyString(candidate.variantId)
    && isNonEmptyString(candidate.productSlug)
    && isNonEmptyString(candidate.name)
    && (candidate.imageUrl === null || typeof candidate.imageUrl === 'string')
    && isNonEmptyString(candidate.color)
    && isNonEmptyString(candidate.size)
    && typeof candidate.unitPrice === 'number'
    && Number.isFinite(candidate.unitPrice)
    && candidate.unitPrice >= 0
    && Number.isInteger(candidate.quantity)
    && (candidate.quantity as number) > 0
    && (candidate.quantity as number) <= MAX_CART_ITEM_QUANTITY
    && Number.isInteger(candidate.maxStock)
    && (candidate.maxStock as number) > 0
    && (candidate.maxStock as number) <= MAX_CART_ITEM_QUANTITY
}

export function parseStoredCartItems(value: unknown): CartItem[] {
  return Array.isArray(value) ? value.filter(isCartItem) : []
}
