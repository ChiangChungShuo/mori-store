import type { CartItem } from '@/features/cart/types'

export type CartVariantSnapshot = Omit<CartItem, 'quantity'>
export type CartRefreshRequestItem = Pick<CartItem, 'variantId' | 'quantity'>

export function parseCartRefreshRequest(value: unknown): CartRefreshRequestItem[] | null {
  if (!value || typeof value !== 'object') return null
  const items = (value as { items?: unknown }).items
  if (!Array.isArray(items)) return null

  const valid = items.every((item) => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as Record<string, unknown>
    return typeof candidate.variantId === 'string'
      && candidate.variantId.length > 0
      && Number.isInteger(candidate.quantity)
      && (candidate.quantity as number) > 0
  })

  return valid ? items as CartRefreshRequestItem[] : null
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
    if (!snapshot || snapshot.maxStock <= 0) return []

    return [{
      ...snapshot,
      quantity: Math.min(item.quantity, snapshot.maxStock),
    }]
  })
}
