import Link from 'next/link'
import { formatTwd } from '@/lib/money'
import type { CatalogProduct } from '@/features/catalog/queries'

export function ProductCard({ product }: { product: CatalogProduct }) {
  const colors = new Set(product.variants.map((variant) => variant.color))
  const sizes = [...new Set(product.variants.map((variant) => variant.size))]
    .sort((a, b) => a.localeCompare(b, 'zh-Hant', { numeric: true }))
  const minimumPrice = Math.min(...product.variants.map((variant) => variant.price))

  return (
    <article className="product-card">
      <Link
        href={`/products/${product.slug}`}
        className="product-image-link"
        aria-label={`查看 ${product.name}`}
      >
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.imageAlt} className="product-image" />
        ) : (
          <span className="product-image-placeholder" aria-hidden="true">mori</span>
        )}
      </Link>
      <div className="product-card-body">
        {product.isNew ? <p className="product-kicker">new</p> : null}
        <h2><Link href={`/products/${product.slug}`}>{product.name}</Link></h2>
        <p>{colors.size} 種顏色</p>
        <p>尺寸 {sizes[0]}–{sizes.at(-1)}</p>
        <p className="product-price">{formatTwd(minimumPrice)} 起</p>
      </div>
    </article>
  )
}
