import { listProductRatings } from '@/features/reviews/product-review-data'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ProductCard } from '@/features/catalog/product-card'
import { getProductAvailability } from '@/features/catalog/availability'
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
  const [products, bannerSlides, ratings] = await Promise.all([
    listProducts({}),
    getBannerSlides(),
    listProductRatings(),
  ])
  const newProducts = products.filter((product) => product.isNew).slice(0, 8)
  // A first-time visitor wants to know what other people buy before they want to
  // know what is new. Falls back to in-stock picks so the row is never empty —
  // with a heading that matches whichever list it ends up showing.
  const bestSellers = products.filter((product) => product.tags?.includes('熱賣')).slice(0, 4)
  const readyToShip = products.filter((product) => getProductAvailability(product) === 'available').slice(0, 4)
  const loved = bestSellers.length >= 2 ? bestSellers : readyToShip
  const lovedIsRanked = bestSellers.length >= 2
  // Second buying moment, placed in the long brand stretch further down.
  const alreadyShown = new Set([...loved, ...newProducts].map((product) => product.id))
  const keepBrowsing = products.filter((product) => !alreadyShown.has(product.id)).slice(0, 4)

  return (
    <main>
      <HeroCarousel slides={bannerSlides} />

      <nav className="section storefront-shortcuts" aria-label="快速挑選商品">
        <Link href="/products?view=ready"><span>ready to ship</span><strong>現貨快速出貨</strong><small>不用等預購，先挑現在有貨的尺寸</small></Link>
        <Link href="/products?view=preorder"><span>pre-order</span><strong>預購新品</strong><small>查看本季新款與預計出貨說明</small></Link>
        <Link href="/products?view=popular"><span>most loved</span><strong>本週熱賣</strong><small>大家最近正在看的熱門款式</small></Link>
        <Link href="/products#categories"><span>all categories</span><strong>依分類瀏覽</strong><small>上衣、褲裝、洋裝與更多品項</small></Link>
      </nav>

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

      {loved.length > 0 ? (
        <section id="popular" className="section" aria-labelledby="popular-title">
          <header className="section-heading">
            <div>
              <p className="eyebrow">{lovedIsRanked ? 'most loved' : 'ready to ship'}</p>
              <h2 id="popular-title">{lovedIsRanked ? '大家都在買' : '現貨，今天就能訂'}</h2>
            </div>
            <Link href={lovedIsRanked ? '/products?view=popular' : '/products?view=ready'} className="text-link">
              {lovedIsRanked ? '看全部熱賣 →' : '看全部現貨 →'}
            </Link>
          </header>
          <p className="section-lede">{lovedIsRanked ? '這幾件最近最多爸媽回購，尺寸偏好與版型都在商品頁寫清楚了。' : '有庫存、下單後就能安排出貨的日常款式。'}</p>
          <div className="product-grid">
            {loved.map((product) => <ProductCard product={product} key={product.id} rating={ratings.get(product.id)} />)}
          </div>
        </section>
      ) : null}

      <section id="new" className="section" aria-labelledby="new-title">
        <header className="section-heading">
          <div><p className="eyebrow">new arrivals</p><h2 id="new-title">本週新到貨</h2></div>
          <Link href="/products" className="text-link">查看全部 →</Link>
        </header>
        {newProducts.length === 0 ? (
          <p>商品準備中，第一批新品很快見面。</p>
        ) : (
          <div className="product-grid">
            {newProducts.map((product) => <ProductCard product={product} key={product.id} rating={ratings.get(product.id)} />)}
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

      {keepBrowsing.length > 0 ? (
        <section className="section home-keep-browsing" aria-labelledby="keep-browsing-title">
          <header className="section-heading">
            <div><p className="eyebrow">keep looking</p><h2 id="keep-browsing-title">再看看這幾件</h2></div>
            <Link href="/products" className="text-link">瀏覽全部商品 →</Link>
          </header>
          <div className="product-grid">
            {keepBrowsing.map((product) => <ProductCard product={product} key={product.id} rating={ratings.get(product.id)} />)}
          </div>
          <p className="home-keep-browsing-cta">
            <Link className="button" href="/products">挑選日常衣櫥</Link>
            <small>滿 NT$1,500 免運・7-ELEVEN 取貨</small>
          </p>
        </section>
      ) : null}

      <section id="story" className="section brand-story" aria-labelledby="story-title">
        <p className="eyebrow">our point of view</p>
        <h2 id="story-title">衣服不該限制孩子怎麼玩。</h2>
        <p>MORI 的開始，源自於一位媽媽為孩子挑選衣服時的龜毛。因為知道孩子每天都穿在身上，所以更在意每一塊布料、每一份舒適與耐穿，也希望把這份安心，分享給每一位來到 MORI 的孩子。</p>
        <dl className="story-values">
          <div><dt>01</dt><dd>舒服，是每天願意穿的第一件事。</dd></div>
          <div><dt>02</dt><dd>耐穿，才能陪著孩子真正生活。</dd></div>
          <div><dt>03</dt><dd>簡單自在，搭配獨特且屬於自己的風格。</dd></div>
        </dl>
      </section>
    </main>
  )
}
