import type { CartItem } from '@/features/cart/types'

export type CartAction =
  | { type: 'add'; item: CartItem }
  | { type: 'setQuantity'; variantId: string; quantity: number }
  | { type: 'remove'; variantId: string }
  | { type: 'clear' }

function capQuantity(quantity: number, maxStock: number) {
  return Math.min(Math.max(1, quantity), maxStock)
}

export function cartReducer(items: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'add': {
      const existing = items.find((item) => item.variantId === action.item.variantId)

      if (!existing) {
        return [...items, {
          ...action.item,
          quantity: capQuantity(action.item.quantity, action.item.maxStock),
        }]
      }

      return items.map((item) => item.variantId === action.item.variantId
        ? {
            ...action.item,
            quantity: capQuantity(item.quantity + action.item.quantity, action.item.maxStock),
          }
        : item)
    }
    case 'setQuantity':
      return items.map((item) => item.variantId === action.variantId
        ? { ...item, quantity: capQuantity(action.quantity, item.maxStock) }
        : item)
    case 'remove':
      return items.filter((item) => item.variantId !== action.variantId)
    case 'clear':
      return []
  }
}
