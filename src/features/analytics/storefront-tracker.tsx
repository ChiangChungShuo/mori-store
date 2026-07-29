'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { trackStorefrontEvent } from '@/features/analytics/tracker'

export function StorefrontTracker() {
  const pathname = usePathname()

  useEffect(() => {
    trackStorefrontEvent('page_view', { path: pathname })
  }, [pathname])

  return null
}

export function ProductViewTracker({ name }: { name: string }) {
  useEffect(() => {
    trackStorefrontEvent('product_view', { productName: name })
  }, [name])
  return null
}

export function PurchaseTracker() {
  useEffect(() => {
    trackStorefrontEvent('purchase')
  }, [])
  return null
}
