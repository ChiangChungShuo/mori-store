import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ProductCard } from '@/features/catalog/product-card'
import { listProducts } from '@/features/catalog/queries'
import { getBannerSlides } from '@/features/storefront/banner-settings'
import { HeroCarousel } from '@/features/storefront/hero-carousel'
import { absoluteUrl } from '@/lib/site'
import { normalizeSeriesName } from '@/features/catalog/product-presentation'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  description: '為 0–12 歲孩子挑選親膚、耐穿、好活動的日常童裝，台灣本島超商取貨、滿額免運。',
  alternates: { canonical: absoluteUrl('/') },
}

export default async function StoreHomePage() {
  const [products, bannerSlides] = await Promise.all([
    listProducts({}),
    getBannerSlides(),
  ])
  const newProducts = products.filter((product) => product.isNew).slice(0, 8)
  const featuredSeries = products.flatMap((product) => product.series)[0]
  const featuredProduct = featuredSeries
    ? products.find((product) => product.series.some((series) => series.id === featuredSeries.id) && product.imageUrl)
    : products.find((product) => product.imageUrl)
  const featuredSeriesName = featuredSeries
    ? normalizeSeriesName(featuredSeries.name)
    : 'MORIMUR BABY 日常選品'
  const featuredSeriesHref = featuredSeries
    ? `/products?series=${encodeURIComponent(featuredSeries.name)}`
    : '/products'

  return (
    <main>
      <HeroCarousel slides={bannerSlides} />

      <nav className="section storefront-shortcuts" aria-label="快速挑選商品">
        <Link href="/products?view=ready"><span>ready to ship</span><strong>現貨快速出貨</strong><small>不用等預購，先挑現在有貨的尺寸</small></Link>
        <Link href="/products?view=preorder"><span>pre-order</span><strong>預購新品</strong><small>查看本季新款與預計出貨說明</small></Link>
        <Link href="/products?view=popular"><span>most loved</span><strong>本週熱賣</strong><small>大家最近正在看的熱門款式</small></Link>
        <Link href={featuredSeriesHref}><span>featured series</span><strong>依系列瀏覽</strong><small>從本季主打系列開始挑選</small></Link>
      </nav>

      <section id="new" className="section" aria-labelledby="new-title">
        <header className="section-heading">
          <div><p className="eyebrow">new arrivals</p><h2 id="new-title">本週新到貨</h2></div>
          <Link href="/products" className="text-link">查看全部 →</Link>
        </header>
        {newProducts.length === 0 ? (
          <p>商品準備中，第一批新品很快見面。</p>
        ) : (
          <div className="product-grid">
            {newProducts.map((product) => <ProductCard product={product} key={product.id} />)}
          </div>
        )}
      </section>

      <section className="section home-featured-series" aria-labelledby="featured-series-title">
        <div className="home-featured-series-copy">
          <p className="eyebrow">featured series</p>
          <h2 id="featured-series-title">{featuredSeriesName}</h2>
          <p>{featuredProduct?.summary || featuredProduct?.description || '柔軟、自在，也保留孩子每天活動需要的空間。'}</p>
          <Link href={featuredSeriesHref} className="button">逛逛這個系列</Link>
        </div>
        <div className="home-featured-series-image">
          {featuredProduct?.imageUrl ? <Image alt={featuredProduct.imageAlt} fill sizes="(max-width: 58rem) 100vw, 50vw" src={featuredProduct.imageUrl} /> : <span aria-hidden="true">MORIMUR BABY</span>}
        </div>
      </section>

      <section className="section fulfillment-story" aria-labelledby="fulfillment-title">
        <header className="section-heading"><div><p className="eyebrow">from order to pickup</p><h2 id="fulfillment-title">每一筆訂單，都仔細走完五個步驟。</h2></div><p>從確認匯款到包裝寄出，進度清楚、取貨安心。</p></header>
        <ol className="fulfillment-steps">
          <li><span>01</span><strong>完成下單</strong><small>確認商品顏色、尺寸與收件資料</small></li>
          <li><span>02</span><strong>轉帳匯款</strong><small>依訂單資訊完成付款並回填末五碼</small></li>
          <li><span>03</span><strong>核對款項</strong><small>店主確認付款後保留商品與庫存</small></li>
          <li><span>04</span><strong>檢查包裝</strong><small>逐件檢查外觀、尺寸與訂單內容再封裝</small></li>
          <li><span>05</span><strong>超商取貨</strong><small>寄往指定 7-ELEVEN，依簡訊期限領取</small></li>
        </ol>
      </section>

    </main>
  )
}
