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
export const MAX_CART_ITEMS = 50

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export function canonicalizeCartVariantId(value: unknown) {
  return typeof value === 'string' && uuidPattern.test(value)
    ? value.toLowerCase()
    : null
}

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
  return canonicalizeCartVariantId(candidate.variantId) !== null
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
  if (!Array.isArray(value)) return []

  const itemsByVariant = new Map<string, CartItem>()
  for (const item of value) {
    if (!isCartItem(item)) continue
    const variantId = canonicalizeCartVariantId(item.variantId)
    if (!variantId) continue

    const existing = itemsByVariant.get(variantId)
    const maxStock = getCartQuantityLimit(item.maxStock)
    itemsByVariant.set(variantId, {
      ...item,
      variantId,
      maxStock,
      quantity: Math.min((existing?.quantity ?? 0) + item.quantity, maxStock),
    })
  }

  return [...itemsByVariant.values()].slice(0, MAX_CART_ITEMS)
}
