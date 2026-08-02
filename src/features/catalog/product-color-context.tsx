'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type ProductColorContextValue = {
  color: string
  setColor: (color: string) => void
}

const ProductColorContext = createContext<ProductColorContextValue | null>(null)

export function ProductColorProvider({ initialColor, children }: {
  initialColor: string
  children?: ReactNode
}) {
  const [color, setColor] = useState(initialColor)
  const value = useMemo(() => ({ color, setColor }), [color])

  return <ProductColorContext.Provider value={value}>{children}</ProductColorContext.Provider>
}

export function useProductColor() {
  const context = useContext(ProductColorContext)
  if (!context) throw new Error('useProductColor must be used within ProductColorProvider')
  return context
}
