import Link from 'next/link'
import type { Metadata } from 'next'
import { ProductCard } from '@/features/catalog/product-card'
import { ProductFilters } from '@/features/catalog/product-filters'
import { ProductSeriesFilter } from '@/features/catalog/product-series-filter'
import { listAvailableColors, listAvailableSizes, listProducts, parseProductFilters } from '@/features/catalog/queries'
import { ProductSearchTracker } from '@/features/analytics/product-search-tracker'
import { listPopularSearchTerms } from '@/features/catalog/popular-searches'
import { RecentlyViewed } from '@/features/catalog/recently-viewed'
import { listProductRatings } from '@/features/reviews/product-review-data'
import { listProductCategories } from '@/features/catalog/categories'
import { listProductSeries } from '@/features/catalog/product-series'
import { absoluteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '所有商品',
  description: '依年齡、尺寸與顏色，挑選適合孩子的日常童裝。',
  alternates: { canonical: absoluteUrl('/products') },
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseProductFilters(await searchParams)
  const [products, categories, series, sizeOptions, colorOptions, ratings] = await Promise.all([
    listProducts(filters),
    listProductCategories(),
    filters.category ? listProductSeries(filters.category) : Promise.resolve([]),
    listAvailableSizes(),
    listAvailableColors(),
    listProductRatings(),
  ])

  // Only pay for the recovery data when the shopper hit a dead end.
  const [popularTerms, fallbackProducts] = products.length === 0
    ? await Promise.all([listPopularSearchTerms(), listProducts({ inStock: true })])
    : [[], []]
  const rescueProducts = fallbackProducts
    .sort((left, right) => Number(right.tags?.includes('熱賣') ?? false) - Number(left.tags?.includes('熱賣') ?? false))
    .slice(0, 4)

  return (
    <main className="section catalog-page">
      <header className="page-heading">
        <p className="eyebrow">MORIMUR BABY collection</p>
        <h1>孩子的日常衣櫥</h1>
        <p>依年齡、尺寸與顏色，挑到現在真正穿得上的那一件。</p>
      </header>
      <nav className="catalog-view-nav" aria-label="依商品狀態瀏覽">
        <Link aria-current={!filters.view ? 'page' : undefined} href="/products">全部商品</Link>
        <Link aria-current={filters.view === 'ready' ? 'page' : undefined} href="/products?view=ready">現貨快速出貨</Link>
        <Link aria-current={filters.view === 'preorder' ? 'page' : undefined} href="/products?view=preorder">預購新品</Link>
        <Link aria-current={filters.view === 'popular' ? 'page' : undefined} href="/products?view=popular">本週熱賣</Link>
      </nav>
      <nav aria-label="商品分類" className="catalog-categories" id="categories">
        <Link aria-current={!filters.category ? 'page' : undefined} href={filters.view ? `/products?view=${filters.view}` : '/products'}>全部</Link>
        {categories.map((category) => <Link aria-current={filters.category === category ? 'page' : undefined} href={`/products?category=${encodeURIComponent(category)}${filters.view ? `&view=${filters.view}` : ''}`} key={category}>{category}</Link>)}
      </nav>
      <ProductSeriesFilter filters={filters} series={series} />
      {/* Keyed by the applied filters so 清除條件 remounts the form with empty values. */}
      <ProductFilters colorOptions={colorOptions} filters={filters} key={JSON.stringify(filters)} sizeOptions={sizeOptions} />
      <ProductSearchTracker query={filters.q} resultCount={products.length} />
      <p aria-live="polite" className="catalog-count">共 {products.length} 件商品</p>
      {products.length === 0 ? (
        <div className="catalog-empty">
          <h2>{filters.q ? `找不到「${filters.q}」的商品` : '目前沒有符合條件的商品'}</h2>
          <p>{filters.view === 'popular'
            ? '目前尚未標記熱賣商品，可先看看全部商品。'
            : filters.series ? '試試切換其他系列，或查看這個分類的全部商品。'
            : filters.q ? '可能是關鍵字或尺寸寫法不同，換個說法或從下面這些開始逛。'
            : '試試清除部分篩選條件。'}</p>
          {popularTerms.length > 0 ? (
            <div className="catalog-empty-terms">
              <span>其他人都在搜</span>
              {popularTerms.map((term) => (
                <Link href={`/products?q=${encodeURIComponent(term)}`} key={term}>{term}</Link>
              ))}
            </div>
          ) : null}
          <div className="catalog-empty-terms">
            <span>熱門分類</span>
            {categories.slice(0, 5).map((category) => (
              <Link href={`/products?category=${encodeURIComponent(category)}`} key={category}>{category}</Link>
            ))}
          </div>
          <div className="catalog-empty-actions">
            <Link className="button" href="/products">看全部商品</Link>
            <Link className="text-link" href="/products?view=ready">只看現貨 →</Link>
          </div>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => <ProductCard product={product} key={product.id} rating={ratings.get(product.id)} />)}
        </div>
      )}
      {products.length === 0 && rescueProducts.length > 0 ? (
        <section className="section product-recommendations">
          <header className="section-heading"><div><p className="eyebrow">most loved</p><h2>大家最近在買</h2></div></header>
          <div className="product-grid">{rescueProducts.map((product) => <ProductCard key={product.id} product={product} rating={ratings.get(product.id)} />)}</div>
        </section>
      ) : null}
      <RecentlyViewed />
    </main>
  )
}
