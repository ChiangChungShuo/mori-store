import { notFound } from 'next/navigation'
import { VariantPicker } from '@/features/catalog/variant-picker'
import { getProductBySlug } from '@/features/catalog/queries'
import { formatTwd } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const minimumPrice = Math.min(...product.variants.map((variant) => variant.price))

  return (
    <main className="section product-page">
      <div className="product-detail-image">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.imageAlt} className="product-image" />
        ) : (
          <span className="product-image-placeholder" aria-hidden="true">mori</span>
        )}
      </div>
      <div className="product-detail-copy">
        <p className="product-kicker">{product.category} · {product.ageBands.join('／')} 歲</p>
        <h1>{product.name}</h1>
        <p className="product-price">{formatTwd(minimumPrice)} 起</p>
        <p>{product.description}</p>
        <VariantPicker product={product} />
        <dl className="product-notes">
          <div><dt>材質</dt><dd>{product.material}</dd></div>
          <div><dt>尺寸指南</dt><dd>{product.sizeGuide}</dd></div>
          <div><dt>洗滌方式</dt><dd>{product.careInstructions}</dd></div>
        </dl>
      </div>
    </main>
  )
}
