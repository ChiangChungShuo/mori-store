import { ProductCard } from '@/features/catalog/product-card'
import { ProductFilters } from '@/features/catalog/product-filters'
import { listProducts, parseProductFilters } from '@/features/catalog/queries'

export const dynamic = 'force-dynamic'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseProductFilters(await searchParams)
  const products = await listProducts(filters)

  return (
    <main className="section catalog-page">
      <header className="page-heading">
        <p>shop</p>
        <h1>找到孩子喜歡的日常好衣</h1>
      </header>
      <ProductFilters filters={filters} />
      <p aria-live="polite">共 {products.length} 件商品</p>
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
