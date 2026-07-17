import {
  canonicalizeCartVariantId,
  getCartQuantityLimit,
  MAX_CART_ITEMS,
  type CartItem,
} from '@/features/cart/types'

export type CartAction =
  | { type: 'add'; item: CartItem }
  | { type: 'setQuantity'; variantId: string; quantity: number }
  | { type: 'remove'; variantId: string }
  | { type: 'clear' }

function capQuantity(quantity: number, maxStock: number) {
  return Math.min(Math.max(1, quantity), getCartQuantityLimit(maxStock))
}

export function cartReducer(items: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'add': {
      const variantId = canonicalizeCartVariantId(action.item.variantId)
      if (!variantId) return items

      const existing = items.find(
        (item) => canonicalizeCartVariantId(item.variantId) === variantId,
      )
      const maxStock = getCartQuantityLimit(action.item.maxStock)

      if (!existing) {
        if (items.length >= MAX_CART_ITEMS) return items
        return [...items, {
          ...action.item,
          variantId,
          maxStock,
          quantity: capQuantity(action.item.quantity, maxStock),
        }]
      }

      return items.map((item) => canonicalizeCartVariantId(item.variantId) === variantId
        ? {
            ...action.item,
            variantId,
            maxStock,
            quantity: capQuantity(item.quantity + action.item.quantity, maxStock),
          }
        : item)
    }
    case 'setQuantity': {
      const variantId = canonicalizeCartVariantId(action.variantId)
      if (!variantId) return items
      return items.map((item) => canonicalizeCartVariantId(item.variantId) === variantId
        ? { ...item, variantId, quantity: capQuantity(action.quantity, item.maxStock) }
        : item)
    }
    case 'remove': {
      const variantId = canonicalizeCartVariantId(action.variantId)
      if (!variantId) return items
      return items.filter(
        (item) => canonicalizeCartVariantId(item.variantId) !== variantId,
      )
    }
    case 'clear':
      return []
  }
}
