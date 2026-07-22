import Link from 'next/link'
import { WishlistHeaderLink } from '@/features/wishlist/wishlist-header-link'
import { defaultProductCategories } from '@/features/catalog/category-defaults'
import { signOut } from '@/features/auth/actions'
import { BrandLogo } from '@/components/brand-logo'
import { MobileMenu } from '@/components/mobile-menu'

export function SiteHeader({ isSignedIn = false, categories = [...defaultProductCategories] }: { isSignedIn?: boolean; categories?: string[] }) {
  return (
    <header id="top">
      <div className="announcement">
        <p>滿 NT$1,500 免運・7-ELEVEN／全家取貨</p>
      </div>
      <nav aria-label="主要導覽" className="site-nav">
        <MobileMenu ariaLabel="主要導覽" breakpoint="36rem" heading="選單" id="store-mobile-menu">
          <div className="store-mobile-menu-links">
            <section aria-labelledby="store-mobile-products-heading">
              <h2 id="store-mobile-products-heading">商品導覽</h2>
              <Link href="/#new">新品</Link>
              <Link href="/products">所有商品</Link>
              <Link href="/#ages">依年齡</Link>
              {categories.map((category) => <Link href={`/products?category=${encodeURIComponent(category)}`} key={category}>{category}</Link>)}
              <Link href="/#story">品牌故事</Link>
            </section>
            <section aria-labelledby="store-mobile-search-heading">
              <h2 id="store-mobile-search-heading">搜尋</h2>
              <form action="/products" className="store-mobile-search" method="get" role="search">
                <label htmlFor="store-mobile-product-search">搜尋商品</label>
                <input id="store-mobile-product-search" name="q" placeholder="搜尋商品" type="search" />
                <button aria-label="開始搜尋" type="submit">⌕</button>
              </form>
            </section>
            <section aria-labelledby="store-mobile-account-heading">
              <h2 id="store-mobile-account-heading">會員服務</h2>
              <Link href="/account/wishlist">收藏清單</Link>
              {isSignedIn ? <>
                <Link href="/account">會員中心</Link>
                <Link href="/account/orders">我的訂單</Link>
                <form action={signOut}><button type="submit">登出</button></form>
              </> : <>
                <Link href="/login">會員登入</Link>
                <Link href="/signup">建立帳號</Link>
                <Link href="/login?next=/account/orders">會員訂單</Link>
              </>}
              <Link href="/order-lookup">訪客查單</Link>
              <Link href="/admin">老闆後台</Link>
            </section>
          </div>
        </MobileMenu>
        <Link href="/" className="brand" aria-label="mori">
          <BrandLogo />
        </Link>
        <div className="nav-links desktop-navigation">
          <Link href="/#new">新品</Link>
          <Link href="/products">所有商品</Link>
          <Link href="/#ages">依年齡</Link>
          <details className="nav-category-menu">
            <summary>全部分類 <span aria-hidden="true">⌄</span></summary>
            <div>
              <Link href="/products">所有商品</Link>
              {categories.map((category) => <Link href={`/products?category=${encodeURIComponent(category)}`} key={category}>{category}</Link>)}
            </div>
          </details>
          <Link href="/#story">品牌故事</Link>
        </div>
        <div className="nav-actions desktop-navigation">
          <WishlistHeaderLink />
          <details className="account-menu">
            <summary aria-label="會員選單">
              <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" /></svg>
            </summary>
            <div className="account-menu-panel">
              <header><small>{isSignedIn ? 'WELCOME BACK' : 'MORI MEMBER'}</small><strong>{isSignedIn ? '會員服務' : '登入後管理訂單與收藏'}</strong></header>
              {isSignedIn ? <>
                <Link href="/account">會員中心</Link>
                <Link href="/account/orders">我的訂單</Link>
                <Link href="/account/wishlist">收藏清單</Link>
                <form action={signOut}><button type="submit">登出</button></form>
              </> : <>
                <Link href="/login">會員登入</Link>
                <Link href="/signup">建立帳號</Link>
                <Link href="/login?next=/account/orders">會員訂單</Link>
              </>}
              <Link href="/order-lookup">訪客查單</Link>
              <Link className="account-menu-admin" href="/admin">老闆後台</Link>
            </div>
          </details>
          <form action="/products" className="header-search" method="get" role="search">
            <label htmlFor="header-product-search">搜尋商品</label>
            <input id="header-product-search" name="q" placeholder="搜尋商品" type="search" />
            <button aria-label="開始搜尋" type="submit">⌕</button>
          </form>
        </div>
      </nav>
    </header>
  )
}
