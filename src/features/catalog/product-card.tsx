import Link from 'next/link'
import { formatTwd } from '@/lib/money'
import type { CatalogProduct } from '@/features/catalog/queries'
import { WishlistButton } from '@/features/wishlist/wishlist-button'
import { getProductAvailability } from '@/features/catalog/availability'
import { splitProductDisplayName } from '@/features/catalog/product-presentation'
import { ProductCardImage } from '@/features/catalog/product-card-image'
import { isPreorder } from '@/lib/preorder'

export function ProductCard({ product }: { product: CatalogProduct }) {
  const colors = new Set(product.variants.map((variant) => variant.color))
  const sizes = [...new Set(product.variants.map((variant) => variant.size))]
    .sort((a, b) => a.localeCompare(b, 'zh-Hant', { numeric: true }))
  const sizeLabel = sizes.length === 1 ? sizes[0] : `${sizes[0]}–${sizes.at(-1)}`
  const minimumPrice = Math.min(...product.variants.map((variant) => variant.price))
  const compareAtPrice = Math.max(...product.variants.map((variant) => variant.compareAtPrice ?? 0))
  const displayName = splitProductDisplayName(product.name)
  const availability = getProductAvailability(product)
  const preorder = isPreorder(product.tags)
  const bestSeller = product.tags?.includes('熱賣') ?? false
  const soldOut = availability === 'sold_out'
  const bundleTier = [...(product.quantityPrices ?? [])].sort((a, b) => a.quantity - b.quantity)[0]
  const bundleSaving = bundleTier ? Math.max(0, minimumPrice * bundleTier.quantity - bundleTier.bundlePrice) : 0
  const comingSoonDate = availability === 'coming_soon' && product.availableAt
    ? new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric' }).format(new Date(product.availableAt))
    : null
  const image = <>
    {product.imageUrl ? (
      <ProductCardImage
        alt={product.imageAlt}
        hoverUrl={product.images?.[1]?.url ?? null}
        url={product.imageUrl}
      />
    ) : (
      <span className="product-image-placeholder" aria-hidden="true">mori</span>
    )}
    {soldOut ? <span className="product-availability" data-status="sold_out">售完</span> : null}
    {!soldOut && preorder ? <span className="product-availability" data-status="preorder">預購</span> : null}
    {!soldOut && bestSeller ? <span className="product-availability" data-status="popular">熱賣</span> : null}
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
        {displayName.series ? <p className="product-card-series">{displayName.series}</p> : null}
        <h2><Link href={`/products/${product.slug}`}>{displayName.title}</Link></h2>
        <div className="product-card-footer">
          <p className="product-card-options"><span><span className="sr-only">{colors.size} 種顏色</span><span aria-hidden="true">{colors.size} 色</span></span><span aria-hidden="true">・</span><span>尺寸 {sizeLabel}</span></p>
          <p className="product-price-group"><span className="product-price">{formatTwd(minimumPrice)}</span>{compareAtPrice > minimumPrice ? <del>{formatTwd(compareAtPrice)}</del> : null}</p>
        </div>
        {bundleTier && bundleSaving > 0 ? (
          <p className="product-card-bundle">
            <strong>任 {bundleTier.quantity} 件 {formatTwd(bundleTier.bundlePrice)}</strong>
            <span>省 {formatTwd(bundleSaving)}</span>
          </p>
        ) : null}
      </div>
    </article>
  )
}
