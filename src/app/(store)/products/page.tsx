import Link from 'next/link'
import type { Metadata } from 'next'
import { ProductCard } from '@/features/catalog/product-card'
import { ProductFilters } from '@/features/catalog/product-filters'
import { listProducts, parseProductFilters } from '@/features/catalog/queries'
import { ProductSearchTracker } from '@/features/analytics/product-search-tracker'
import { listProductCategories } from '@/features/catalog/categories'
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
  const [products, categories] = await Promise.all([listProducts(filters), listProductCategories()])

  return (
    <main className="section catalog-page">
      <header className="page-heading">
        <p className="eyebrow">mori collection</p>
        <h1>孩子的日常衣櫥</h1>
        <p>依年齡、尺寸與顏色，挑到現在真正穿得上的那一件。</p>
      </header>
      <nav aria-label="商品分類" className="catalog-categories" id="categories">
        <Link aria-current={!filters.category ? 'page' : undefined} href="/products">全部</Link>
        {categories.map((category) => <Link aria-current={filters.category === category ? 'page' : undefined} href={`/products?category=${encodeURIComponent(category)}`} key={category}>{category}</Link>)}
      </nav>
      <ProductFilters categories={categories} filters={filters} />
      <ProductSearchTracker query={filters.q} resultCount={products.length} />
      <p aria-live="polite" className="catalog-count">共 {products.length} 件商品</p>
      {products.length === 0 ? (
        <div className="catalog-empty">
          <h2>目前沒有符合條件的商品</h2>
          <p>試試清除部分篩選條件。</p>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => <ProductCard product={product} key={product.id} />)}
        </div>
      )}
    </main>
  )
}
