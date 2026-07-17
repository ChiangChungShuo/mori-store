import {
  getCartQuantityLimit,
  MAX_CART_ITEM_QUANTITY,
  type CartItem,
} from '@/features/cart/types'

export type CartVariantSnapshot = Omit<CartItem, 'quantity'>
export type CartRefreshRequestItem = Pick<CartItem, 'variantId' | 'quantity'>

const MAX_CART_REFRESH_ITEMS = 50
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export function parseCartRefreshRequest(value: unknown): CartRefreshRequestItem[] | null {
  if (!value || typeof value !== 'object') return null
  const items = (value as { items?: unknown }).items
  if (!Array.isArray(items) || items.length > MAX_CART_REFRESH_ITEMS) return null

  const valid = items.every((item) => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as Record<string, unknown>
    return typeof candidate.variantId === 'string'
      && uuidPattern.test(candidate.variantId)
      && Number.isInteger(candidate.quantity)
      && (candidate.quantity as number) > 0
      && (candidate.quantity as number) <= MAX_CART_ITEM_QUANTITY
  })

  if (!valid) return null

  const uniqueItems = new Map<string, CartRefreshRequestItem>()
  for (const item of items as CartRefreshRequestItem[]) {
    const variantId = item.variantId.toLowerCase()
    if (!uniqueItems.has(variantId)) {
      uniqueItems.set(variantId, { ...item, variantId })
    }
  }
  return [...uniqueItems.values()]
}

export function reconcileCartItems(
  currentItems: CartRefreshRequestItem[],
  snapshots: CartVariantSnapshot[],
): CartItem[] {
  const snapshotsById = new Map(
    snapshots.map((snapshot) => [snapshot.variantId, snapshot]),
  )

  return currentItems.flatMap((item) => {
    const snapshot = snapshotsById.get(item.variantId)
    if (!snapshot) return []
    const maxStock = getCartQuantityLimit(snapshot.maxStock)
    if (maxStock <= 0) return []

    return [{
      ...snapshot,
      maxStock,
      quantity: Math.min(item.quantity, maxStock),
    }]
  })
}
