import Link from 'next/link'
import type { ProductSeries } from '@/features/catalog/product-series'
import type { ProductFilters } from '@/features/catalog/queries'
import { normalizeProductName } from '@/features/catalog/product-presentation'

function seriesHref(filters: ProductFilters, series?: string) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (key !== 'series' && value !== undefined && value !== false) {
      params.set(key, String(value))
    }
  })
  if (series) params.set('series', series)
  return `/products?${params.toString()}`
}

export function ProductSeriesFilter({
  filters,
  series,
}: {
  filters: ProductFilters
  series: ProductSeries[]
}) {
  if (!filters.category || series.length === 0) return null

  return (
    <nav aria-label="商品系列" className="catalog-series">
      <span className="catalog-series-label">選擇系列</span>
      <Link aria-current={!filters.series ? 'page' : undefined} href={seriesHref(filters)}>
        全部{filters.category}
      </Link>
      {series.map((item) => (
        <Link
          aria-current={filters.series === item.name ? 'page' : undefined}
          href={seriesHref(filters, item.name)}
          key={item.id}
        >
          {normalizeProductName(item.name)}
        </Link>
      ))}
    </nav>
  )
}
