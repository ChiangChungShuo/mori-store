import Link from 'next/link'
import type { ProductSeries } from '@/features/catalog/product-series'
import { normalizeProductName } from '@/features/catalog/product-presentation'

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
        {categories.map((category, index) => {
          const categorySeries = series.filter((item) => item.categoryName === category)
          return (
            <details key={category}>
              <summary>
                <span className="mobile-category-summary-copy">
                  <small aria-hidden="true">{String(index + 1).padStart(2, '0')}</small>
                  <strong>{category}</strong>
                  <em>{categorySeries.length > 0 ? `${categorySeries.length} 個系列` : '查看商品'}</em>
                </span>
                <span aria-hidden="true" className="category-menu-chevron">⌄</span>
              </summary>
              <div>
                <Link className="mobile-category-view-all" href={categoryHref(category)}>全部{category}</Link>
                {categorySeries.map((item) => (
                  <Link href={seriesHref(category, item.name)} key={item.id}>{normalizeProductName(item.name)}</Link>
                ))}
              </div>
            </details>
          )
        })}
      </div>
    )
  }

  return (
    <nav aria-label="商品分類與系列" className="desktop-category-series-menu">
      <header className="desktop-category-menu-heading">
        <p><small>SHOP BY CATEGORY</small><strong>依分類挑選</strong></p>
        <Link href="/products">所有商品<span aria-hidden="true">↗</span></Link>
      </header>
      <div className="desktop-category-menu-body">
        <div className="desktop-category-column">
          {categories.map((category, index) => {
            const categorySeries = series.filter((item) => item.categoryName === category)
            return (
              <div className="desktop-category-item" key={category}>
                <Link href={categoryHref(category)}>
                  <small aria-hidden="true">{String(index + 1).padStart(2, '0')}</small>
                  <span><strong>{category}</strong><em>{categorySeries.length > 0 ? `${categorySeries.length} 個系列` : '查看商品'}</em></span>
                  <b aria-hidden="true">→</b>
                </Link>
                <section aria-label={`${category}系列`} className="desktop-series-column">
                  <p>COLLECTION</p>
                  <header><strong>{category}系列</strong><small>不同尺寸與款式，都在這裡慢慢挑。</small></header>
                  <Link aria-label={`全部${category}`} className="desktop-series-view-all" href={categoryHref(category)}>
                    <span>全部{category}</span><small aria-hidden="true">VIEW ALL　→</small>
                  </Link>
                  <div className="desktop-series-links">
                    {categorySeries.map((item) => (
                      <Link href={seriesHref(category, item.name)} key={item.id}>{normalizeProductName(item.name)}</Link>
                    ))}
                    {categorySeries.length === 0 ? <span className="desktop-series-empty">此分類目前沒有另外分系列</span> : null}
                  </div>
                </section>
              </div>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
