import Link from 'next/link'
import { formatTwd } from '@/lib/money'
import type { CatalogProduct } from '@/features/catalog/queries'
import { WishlistButton } from '@/features/wishlist/wishlist-button'
import { getProductAvailability } from '@/features/catalog/availability'
import { isPreorder } from '@/lib/preorder'

export function ProductCard({ product }: { product: CatalogProduct }) {
  const colors = new Set(product.variants.map((variant) => variant.color))
  const sizes = [...new Set(product.variants.map((variant) => variant.size))]
    .sort((a, b) => a.localeCompare(b, 'zh-Hant', { numeric: true }))
  const minimumPrice = Math.min(...product.variants.map((variant) => variant.price))
  const availability = getProductAvailability(product)
  const preorder = isPreorder(product.tags)
  const soldOut = availability === 'sold_out'
  const comingSoonDate = availability === 'coming_soon' && product.availableAt
    ? new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric' }).format(new Date(product.availableAt))
    : null
  const image = <>
    {product.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={product.imageUrl} alt={product.imageAlt} className="product-image" />
    ) : (
      <span className="product-image-placeholder" aria-hidden="true">mori</span>
    )}
    {soldOut ? <span className="product-availability" data-status="sold_out">售完</span> : null}
    {!soldOut && preorder ? <span className="product-availability" data-status="preorder">預購</span> : null}
    {availability === 'coming_soon' ? <span className="product-availability" data-status="coming_soon"><small>即將上架</small>預計 {comingSoonDate} 開賣</span> : null}
    <span className="product-card-action">查看商品 <span aria-hidden="true">↗</span></span>
  </>

  return (
    <article className="product-card" data-availability={availability}>
      <WishlistButton compact productId={product.id} productName={product.name} />
      <Link
        href={`/products/${product.slug}`}
        className="product-image-link"
        aria-label={`查看 ${product.name}`}
      >{image}</Link>
      <div className="product-card-body">
        <div className="product-card-meta">
          <p className="product-kicker">{product.isNew ? 'new arrival' : product.category}</p>
          <p><span className="sr-only">{colors.size} 種顏色</span>{[...colors].slice(0, 3).join('・')}</p>
        </div>
        <h2><Link href={`/products/${product.slug}`}>{product.name}</Link></h2>
        {product.summary ? <p className="product-card-summary">{product.summary}</p> : null}
        <div className="product-card-footer">
          <p>尺寸 {sizes[0]}–{sizes.at(-1)}</p>
          <p className="product-price">{formatTwd(minimumPrice)} 起</p>
        </div>
      </div>
    </article>
  )
}
