import Link from 'next/link'
import type { ProductSeries } from '@/features/catalog/product-series'

function categoryHref(category: string) {
  return `/products?category=${encodeURIComponent(category)}`
}

function seriesHref(category: string, series: string) {
  return `${categoryHref(category)}&series=${encodeURIComponent(series)}`
}

export function CategorySeriesMenu({
  categories,
  series,
  variant,
}: {
  categories: string[]
  series: ProductSeries[]
  variant: 'desktop' | 'mobile'
}) {
  if (variant === 'mobile') {
    return (
      <div className="mobile-category-series-menu">
        {categories.map((category) => (
          <details key={category}>
            <summary>{category}<span aria-hidden="true">⌄</span></summary>
            <div>
              <Link href={categoryHref(category)}>全部{category}</Link>
              {series.filter((item) => item.categoryName === category).map((item) => (
                <Link href={seriesHref(category, item.name)} key={item.id}>{item.name}</Link>
              ))}
            </div>
          </details>
        ))}
      </div>
    )
  }

  return (
    <div className="desktop-category-series-menu">
      <div className="desktop-category-column">
        <Link href="/products">所有商品</Link>
        {categories.map((category) => (
          <div className="desktop-category-item" key={category}>
            <Link href={categoryHref(category)}>{category}<span aria-hidden="true">›</span></Link>
            <div className="desktop-series-column">
              <strong>{category}系列</strong>
              <Link href={categoryHref(category)}>全部{category}</Link>
              {series.filter((item) => item.categoryName === category).map((item) => (
                <Link href={seriesHref(category, item.name)} key={item.id}>{item.name}</Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
