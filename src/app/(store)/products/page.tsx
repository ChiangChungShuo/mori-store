import Link from 'next/link'
import type { Metadata } from 'next'
import { ProductCard } from '@/features/catalog/product-card'
import { ProductFilters } from '@/features/catalog/product-filters'
import { ProductSeriesFilter } from '@/features/catalog/product-series-filter'
import { listAvailableColors, listAvailableSizes, listProducts, parseProductFilters } from '@/features/catalog/queries'
import { ProductSearchTracker } from '@/features/analytics/product-search-tracker'
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
  const [products, categories, series, sizeOptions, colorOptions] = await Promise.all([
    listProducts(filters),
    listProductCategories(),
    filters.category ? listProductSeries(filters.category) : Promise.resolve([]),
    listAvailableSizes(),
    listAvailableColors(),
  ])

  return (
    <main className="section catalog-page">
      <header className="page-heading">
        <p className="eyebrow">mori collection</p>
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
          <h2>目前沒有符合條件的商品</h2>
          <p>{filters.view === 'popular' ? '目前尚未標記熱賣商品，可先看看全部商品。' : filters.series ? '試試切換其他系列，或查看這個分類的全部商品。' : '試試清除部分篩選條件。'}</p>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => <ProductCard product={product} key={product.id} />)}
        </div>
      )}
    </main>
  )
}
