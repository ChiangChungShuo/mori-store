import Link from 'next/link'
import type { ReactNode } from 'react'
import { WishlistHeaderLink } from '@/features/wishlist/wishlist-header-link'
import { defaultProductCategories } from '@/features/catalog/category-defaults'
import { signOut } from '@/features/auth/actions'
import { BrandLogo } from '@/components/brand-logo'
import { MobileMenu } from '@/components/mobile-menu'
import { MobileHeaderSearch } from '@/components/mobile-header-search'
import { DesktopHeaderSearch } from '@/components/desktop-header-search'
import { AutoCloseDetails } from '@/components/auto-close-details'
import { CategorySeriesMenu } from '@/components/category-series-menu'
import type { ProductSeries } from '@/features/catalog/product-series'
import { formatTwd } from '@/lib/money'

export function SiteHeader({ cart, isSignedIn = false, isAdmin = false, categories = [...defaultProductCategories], series = [], freeShippingThreshold = null }: { cart?: ReactNode; isSignedIn?: boolean; isAdmin?: boolean; categories?: string[]; series?: ProductSeries[]; freeShippingThreshold?: number | null }) {
  return (
    <header id="top">
      <div className="announcement">
        <p>{freeShippingThreshold ? `滿 ${formatTwd(freeShippingThreshold)} 免運・7-ELEVEN 取貨` : '7-ELEVEN 超商取貨'}</p>
      </div>
      <nav aria-label="主要導覽" className="site-nav">
        <div className="store-mobile-left">
          <MobileMenu ariaLabel="主要導覽" breakpoint="36rem" heading="選單" id="store-mobile-menu" side="left">
            <div className="store-mobile-menu-links">
              <section aria-labelledby="store-mobile-products-heading">
                <h2 id="store-mobile-products-heading">商品導覽</h2>
                <Link href="/#new">新品</Link>
                <Link href="/products">所有商品</Link>
                <Link href="/#ages">依年齡</Link>
                <details className="store-mobile-categories">
                  <summary>商品分類 <span aria-hidden="true">⌄</span></summary>
                  <CategorySeriesMenu categories={categories} series={series} variant="mobile" />
                </details>
                <Link href="/#story">品牌故事</Link>
              </section>
              <section aria-labelledby="store-mobile-service-heading">
                <h2 id="store-mobile-service-heading">服務</h2>
                <Link href="/order-lookup">訪客查單</Link>
                <Link href="/faq">常見問題</Link>
                {isAdmin ? <Link href="/admin">老闆後台</Link> : null}
              </section>
            </div>
          </MobileMenu>
          <MobileHeaderSearch />
        </div>
        <Link href="/" className="brand" aria-label="MORIMUR BABY 首頁">
          <BrandLogo />
        </Link>
        <div className="store-mobile-right">
          <Link
            aria-label={isSignedIn ? '前往會員中心' : '會員登入'}
            className="mobile-header-icon-button mobile-account-link"
            href={isSignedIn ? '/account' : '/login?next=/account'}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" /></svg>
          </Link>
          {cart}
        </div>
        <div className="nav-links desktop-navigation">
          <Link href="/#new">新品</Link>
          <Link href="/products">所有商品</Link>
          <Link href="/#ages">依年齡</Link>
          <AutoCloseDetails className="nav-category-menu">
            <summary>全部分類 <span aria-hidden="true">⌄</span></summary>
            <CategorySeriesMenu categories={categories} series={series} variant="desktop" />
          </AutoCloseDetails>
          <Link href="/#story">品牌故事</Link>
        </div>
        <div className="nav-actions desktop-navigation">
          {isSignedIn ? <WishlistHeaderLink /> : null}
          <AutoCloseDetails className="account-menu">
            <summary aria-label="會員選單">
              <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" /></svg>
            </summary>
            <div className="account-menu-panel">
              <header><small>{isSignedIn ? 'WELCOME BACK' : 'MORI MEMBER'}</small><strong>{isSignedIn ? '會員服務' : '登入後管理訂單與收藏'}</strong></header>
              {isSignedIn ? <>
                <Link href="/account">會員中心</Link>
                <Link href="/account/orders">我的訂單</Link>
                <Link href="/wishlist">收藏清單</Link>
                <form action={signOut}><button type="submit">登出</button></form>
              </> : <>
                <Link href="/login">會員登入</Link>
                <Link href="/signup">建立帳號</Link>
                <Link href="/login?next=/account/orders">會員訂單</Link>
              </>}
              <Link href="/order-lookup">訪客查單</Link>
              {isAdmin ? <Link className="account-menu-admin" href="/admin">老闆後台</Link> : null}
            </div>
          </AutoCloseDetails>
          <DesktopHeaderSearch />
        </div>
      </nav>
    </header>
  )
}
