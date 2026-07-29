'use client'

import { useEffect } from 'react'
import { trackStorefrontEvent } from '@/features/analytics/tracker'

export function ProductSearchTracker({ query, resultCount }: { query?: string; resultCount: number }) {
  useEffect(() => {
    if (!query) return
    trackStorefrontEvent('search', { searchQuery: query, resultCount })
  }, [query, resultCount])

  return null
}
