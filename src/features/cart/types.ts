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
    && Number.isInteger(candidate.maxStock)
    && (candidate.maxStock as number) > 0
}

export function parseStoredCartItems(value: unknown): CartItem[] {
  return Array.isArray(value) ? value.filter(isCartItem) : []
}
