import Link from 'next/link'
import type { Metadata } from 'next'
import { ProductCard } from '@/features/catalog/product-card'
import { listProducts } from '@/features/catalog/queries'
import { getBannerSlides } from '@/features/storefront/banner-settings'
import { HeroCarousel } from '@/features/storefront/hero-carousel'
import { absoluteUrl } from '@/lib/site'
import { AGE_BANDS } from '@/lib/age-bands'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  description: '為 0–12 歲孩子挑選親膚、耐穿、好活動的日常童裝，台灣本島超商取貨、滿額免運。',
  alternates: { canonical: absoluteUrl('/') },
}

export default async function StoreHomePage() {
  const [products, bannerSlides] = await Promise.all([listProducts({}), getBannerSlides()])
  const newProducts = products.filter((product) => product.isNew)

  return (
    <main>
      <HeroCarousel slides={bannerSlides} />

      <section id="ages" className="section" aria-labelledby="ages-title">
        <header className="section-heading">
          <div><p className="eyebrow">shop by age</p><h2 id="ages-title">照著成長階段挑</h2></div>
          <p>從剛學會走路，到開始有自己的穿搭主張。</p>
        </header>
        <div className="age-links">
          {AGE_BANDS.map((band) => (
            <Link href={`/products?age=${band.value}`} key={band.value}>
              <strong>{band.label}</strong><span>{band.range}</span>
            </Link>
          ))}
        </div>
      </section>

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

      <section className="section category-feature" aria-labelledby="category-title">
        <div className="category-copy">
          <p className="eyebrow">mori selection</p>
          <h2 id="category-title">會跑、會跳，<br />也好好整理。</h2>
          <p>柔軟上衣、耐穿下著與不費力就能搭好的日常單品。</p>
          <Link href="/products" className="button button-light">挑選日常衣櫥</Link>
        </div>
        <div className="category-tags" aria-label="選品原則">
          <span>柔軟親膚</span><span>自在活動</span><span>耐洗耐穿</span>
        </div>
      </section>

      <section id="story" className="section brand-story" aria-labelledby="story-title">
        <p className="eyebrow">our point of view</p>
        <h2 id="story-title">衣服不該限制孩子怎麼玩。</h2>
        <p>mori 從布料、版型到洗滌方式仔細挑選，讓大人少一點煩惱，孩子多一點自在。</p>
        <dl className="story-values">
          <div><dt>01</dt><dd>舒服，是每天願意穿的第一件事。</dd></div>
          <div><dt>02</dt><dd>耐穿，才能陪著孩子真正生活。</dd></div>
          <div><dt>03</dt><dd>簡單搭配，把時間留給更重要的事。</dd></div>
        </dl>
      </section>
    </main>
  )
}
