'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { cartReducer, type CartAction } from '@/features/cart/reducer'
import type { CartItem } from '@/features/cart/types'

const STORAGE_KEY = 'mori-cart-v1'

type CartContextValue = {
  items: CartItem[]
  dispatch: (action: CartAction) => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const storedItems = JSON.parse(stored) as CartItem[]
          setItems(storedItems.reduce<CartItem[]>(
            (current, item) => cartReducer(current, { type: 'add', item }),
            [],
          ))
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
      }
      setHydrated(true)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [hydrated, items])

  const value = useMemo<CartContextValue>(() => ({
    items,
    dispatch(action) {
      setItems((current) => cartReducer(current, action))
    },
  }), [items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('useCart must be used within CartProvider')
  return cart
}
