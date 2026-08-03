import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductCard } from '@/features/catalog/product-card'
import { VariantPicker } from '@/features/catalog/variant-picker'
import { getProductBySlug, listProducts } from '@/features/catalog/queries'
import { getProductQuantityPrices } from '@/features/catalog/quantity-prices'
import { listCustomerPhotos } from '@/features/storefront/customer-photos'
import { getStorefrontSettings } from '@/features/checkout/settings'
import { describeQuantityTier } from '@/features/cart/bundle-pricing'
import { formatTwd } from '@/lib/money'
import { ProductViewTracker } from '@/features/analytics/storefront-tracker'
import { WishlistButton } from '@/features/wishlist/wishlist-button'
import { ProductGallery } from '@/features/catalog/product-gallery'
import { ProductShareButtons } from '@/components/social-share-menu'
import { getProductAvailability } from '@/features/catalog/availability'
import { isPreorder, PREORDER_NOTE, PREORDER_TAG } from '@/lib/preorder'
import { absoluteUrl } from '@/lib/site'
import { ProductColorProvider } from '@/features/catalog/product-color-context'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug
  const product = await getProductBySlug(slug)
  if (!product) return { title: '找不到商品' }

  const description = (product.seoDescription || product.summary || product.description).slice(0, 160)
  const images = product.imageUrl ? [{ url: product.imageUrl, alt: product.imageAlt }] : []
  const productKeywords = [
    product.name,
    product.category,
    ...(product.tags ?? []),
    ...product.ageBands.map((age) => `${age} 歲童裝`),
    product.material,
  ].filter(Boolean).slice(0, 8)
  return {
    title: product.seoTitle ? { absolute: product.seoTitle } : product.name,
    description,
    keywords: productKeywords,
    alternates: { canonical: absoluteUrl(`/products/${slug}`) },
    openGraph: { title: product.name, description, type: 'website', url: absoluteUrl(`/products/${slug}`), images },
    twitter: { card: 'summary_large_image', title: product.name, description, images: images.map((image) => image.url) },
  }
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }
  return shuffled
}

const standardKidsSizeGuide = [
  { size: '80', age: '1–2 歲', height: '75–85 cm', weight: '7–12 kg' },
  { size: '90', age: '2–3 歲', height: '85–95 cm', weight: '12–14 kg' },
  { size: '100', age: '3–4 歲', height: '95–105 cm', weight: '13–19 kg' },
  { size: '110', age: '4–5 歲', height: '105–115 cm', weight: '16–21 kg' },
  { size: '120', age: '5–6 歲', height: '115–125 cm', weight: '19–25 kg' },
  { size: '130', age: '6–7 歲', height: '125–135 cm', weight: '21–28 kg' },
  { size: '140', age: '7–8 歲', height: '135–145 cm', weight: '26–32 kg' },
]

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [product, catalog, quantityPrices, storeSettings] = await Promise.all([
    getProductBySlug(slug),
    listProducts({ inStock: true }),
    getProductQuantityPrices(slug),
    getStorefrontSettings(),
  ])
  if (!product) notFound()
  const customerPhotos = await listCustomerPhotos(product.id)

  const minimumPrice = Math.min(...product.variants.map((variant) => variant.price))
  const availability = getProductAvailability(product)
  const saleDate = availability === 'coming_soon'
    ? new Intl.DateTimeFormat('zh-TW', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(product.availableAt!))
    : null
  const compareAtPrice = Math.max(...product.variants.map((variant) => variant.compareAtPrice ?? 0))
  // Savings are quoted against the cheapest variant so they are never overstated.
  const quantityTiers = quantityPrices
    .map((tier) => describeQuantityTier(tier, minimumPrice))
    .filter((tier) => tier.saving > 0)
  const popularProducts = shuffle(catalog.filter((candidate) => candidate.id !== product.id)).slice(0, 4)
  // The ◷ banner above already says 預購商品, so the tag chip would repeat it.
  const visibleTags = (product.tags ?? []).filter((tag) => tag !== PREORDER_TAG)
  const productImages = product.images?.length
    ? product.images
    : product.imageUrl ? [{ url: product.imageUrl, alt: product.imageAlt, color: null }] : []

  const availabilitySchema = availability === 'available'
    ? 'https://schema.org/InStock'
    : availability === 'coming_soon' ? 'https://schema.org/PreOrder' : 'https://schema.org/OutOfStock'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: product.name,
        description: product.description,
        image: productImages.map((image) => image.url),
        category: product.category,
        brand: { '@type': 'Brand', name: 'mori' },
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'TWD',
          lowPrice: minimumPrice,
          highPrice: Math.max(...product.variants.map((variant) => variant.price)),
          offerCount: product.variants.length,
          availability: availabilitySchema,
          url: absoluteUrl(`/products/${product.slug}`),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '首頁', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: '所有商品', item: absoluteUrl('/products') },
          { '@type': 'ListItem', position: 3, name: product.name, item: absoluteUrl(`/products/${product.slug}`) },
        ],
      },
    ],
  }

  return (
    <main className="product-detail-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductViewTracker name={product.name} />
      <nav className="product-breadcrumb section" aria-label="麵包屑">
        <Link href="/">首頁</Link><span>/</span><Link href="/products">所有商品</Link><span>/</span><span>{product.name}</span>
      </nav>

      <ProductColorProvider initialColor={product.variants[0]?.color ?? ''}><section className="section product-page">
        <div className="product-detail-image"><ProductGallery images={productImages} isNew={product.isNew} /></div>
        <div className="product-detail-copy">
          <div className="product-title-row">
            <div><p className="product-kicker">{product.category} · {product.ageBands.join('／')} 歲</p><h1>{product.name}</h1></div>
          </div>
          {saleDate ? <div className="product-detail-availability" role="status"><span aria-hidden="true">◷</span><p><small>預計開賣</small><strong>商品將於 <time dateTime={product.availableAt!}>{saleDate}</time> 開始販售</strong></p></div> : null}
          {isPreorder(product.tags) ? <div className="product-detail-availability" data-variant="preorder" role="status"><span aria-hidden="true">◷</span><p><small>預購商品</small><strong>{PREORDER_NOTE}</strong></p></div> : null}
          <div className="product-price-row"><p className="product-price">{formatTwd(minimumPrice)}</p>{compareAtPrice > minimumPrice && <del>{formatTwd(compareAtPrice)}</del>}</div>
          {quantityTiers.length > 0 ? <div className="product-bundle-card">
            <p className="product-bundle-heading"><span aria-hidden="true">＋</span>多件優惠・不需優惠碼</p>
            <ul>{quantityTiers.map((tier) => <li key={tier.quantity}>
              <strong>買 {tier.quantity} 件省 {formatTwd(tier.saving)}</strong>
              <small>組合價 {formatTwd(tier.bundlePrice)}・每件約 {formatTwd(tier.perUnit)}</small>
            </li>)}</ul>
            <small className="product-bundle-note">同一商品的不同顏色與尺寸可混搭，購物車會自動套用最優惠的組合。</small>
          </div> : null}
          <p className="product-lead">{product.summary || product.description}</p>
          {visibleTags.length > 0 ? <ul className="product-tags" aria-label="商品標籤">{visibleTags.map((tag) => <li key={tag}>{tag}</li>)}</ul> : null}
          {/* Picking colour/size/quantity is the page's job — it comes right
              after the price so it is visible without scrolling. */}
          <VariantPicker product={product} />
          <div className="product-wishlist-row"><WishlistButton productId={product.id} productName={product.name} /><small>收藏後可在頁首的「收藏」快速找到這件商品。</small></div>
          <ul className="product-feature-list">
            <li><span>寄送</span><strong>7-ELEVEN 門市取貨</strong></li>
            <li><span>付款方式</span><strong>轉帳匯款</strong></li>
          </ul>
          <ProductShareButtons productName={product.name} />
          <p className="product-service-note">{storeSettings.freeShippingThreshold ? `滿 ${formatTwd(storeSettings.freeShippingThreshold)} 免運・` : ''}台灣本島超商配送・會員訂單可追蹤取貨進度</p>
        </div>
      </section></ProductColorProvider>

      <section className="section product-information">
        <header className="section-heading"><div><p className="eyebrow">details & care</p><h2>穿之前，先了解這件衣服。</h2></div><p>從尺寸、材質到洗滌方式，都整理在這裡，讓替孩子選衣更安心。</p></header>
        <div className="product-info-layout">
          <div className="product-info-main">
            <details open><summary>商品特點</summary><div><p className="product-description-body">{product.description}</p><dl className="product-notes"><div><dt>商品分類</dt><dd>{product.category}</dd></div><div><dt>適用年齡</dt><dd>{product.ageBands.join('、')} 歲</dd></div><div><dt>觸感</dt><dd>{product.material}</dd></div><div><dt>活動</dt><dd>為孩子日常跑跳保留舒適空間</dd></div><div><dt>照顧方式</dt><dd>{product.careInstructions}</dd></div></dl></div></details>
            <details open><summary>尺寸表</summary><div><figure className="measurement-guide"><Image src="/images/children-clothing-flat-measurement-guide.png" alt="童裝平量方式：上衣、褲子、包屁衣與連身衣的衣長、胸寬、肩寬、袖長、腰寬、褲長與襠長量測位置" width={1774} height={887} sizes="(max-width: 58rem) calc(100vw - 2rem), 54rem" /><figcaption>將衣服自然攤平、不拉伸布料，再依圖示位置量測；胸寬與腰寬皆為平量單面尺寸。</figcaption></figure><section className="product-fit-guide" aria-label="本商品尺寸與版型資訊"><h3>本商品實際平量與穿著建議</h3><p>{product.sizeGuide || '本商品平量資料整理中，下單前可先向客服詢問孩子適合的尺寸。'}</p></section><div className="size-table-wrap"><table className="size-table"><thead><tr><th>尺寸</th><th>建議年齡</th><th>建議身高</th><th>建議體重</th></tr></thead><tbody>{standardKidsSizeGuide.map((row) => <tr key={row.size}><th>{row.size}</th><td>{row.age}</td><td>{row.height}</td><td>{row.weight}</td></tr>)}</tbody></table></div><small>此表為固定參考值；每位孩子身形不同，購買前請優先依上方商品實際平量、模特兒資訊與版型建議選擇。手工測量可能有 1–2 cm 誤差。</small></div></details>
            <details><summary>購物須知</summary><div><ul className="detail-bullets"><li>購買前請確認下列資訊，同意再行購買。</li><li>請詳閱「購物須知」及「<Link href="/faq#faq-returns">退換貨說明</Link>」，並確認商品價格、尺寸、顏色、款式、數量、商品描述與預計出貨時間。</li><li>付款完成後才會保留庫存；熱門尺寸可能較快售完。</li><li>本店使用 7-ELEVEN 超商取貨，門市到貨後請依通知期限領取。</li><li>商品圖片會因螢幕顯示與拍攝光線產生些微色差，實際顏色以收到商品為準。</li><li>本店一般網購商品依法提供收貨次日起七日解除權；鑑賞期並非試用期。</li><li>除依法得行使的七日解除權，以及商品瑕疵、寄錯或缺件情形外，商品售出後不做退換。</li><li>收到商品後請儘速檢查；如有瑕疵、寄錯或缺件，請立即聯繫客服。為協助釐清商品及物流狀況，建議開箱時全程錄影。</li><li>如需辦理退貨，請於期限內聯繫客服，並盡量保持商品本體、吊牌、配件及包裝完整；若因超出必要檢查範圍而造成商品價值減損，將依相關規定處理。詳情請見「<Link href="/faq#faq-returns">常見問題－退換貨</Link>」。</li></ul></div></details>
          </div>
          <aside className="product-care-card"><p className="eyebrow">care note</p><h3>讓衣服陪孩子久一點</h3><p>{product.careInstructions}</p><div><span>01</span>深淺色分開洗滌</div><div><span>02</span>使用中性洗劑</div><div><span>03</span>依洗標方式晾乾</div></aside>
        </div>
      </section>

      {customerPhotos.length > 0 ? <section className="section customer-photo-section">
        <header className="section-heading"><div><p className="eyebrow">community</p><h2>大家怎麼穿</h2></div><p>謝謝媽咪們分享的日常穿搭（皆經同意刊登）。</p></header>
        <div className="customer-photo-strip">
          {customerPhotos.map((photo) => (
            <figure key={photo.id}>
              <Image alt={photo.caption || '顧客穿搭分享'} fill sizes="(max-width: 40rem) 60vw, 18rem" src={photo.imageUrl} />
              {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      </section> : null}

      {popularProducts.length > 0 && <section className="section product-recommendations"><header className="section-heading"><div><p className="eyebrow">popular right now</p><h2>大家也在看</h2></div><p>每次隨機整理不同熱門款式，看看還有哪些適合孩子的日常選擇。</p></header><div className="product-grid">{popularProducts.map((candidate) => <ProductCard key={candidate.id} product={candidate} />)}</div></section>}
    </main>
  )
}
