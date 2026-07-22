import Link from 'next/link'
import { defaultProductCategories } from '@/features/catalog/category-defaults'
import { signOut } from '@/features/auth/actions'
import { BrandLogo } from '@/components/brand-logo'
import { MobileMenu } from '@/components/mobile-menu'

export function SiteHeader({ isSignedIn = false, categories = [...defaultProductCategories] }: { isSignedIn?: boolean; categories?: string[] }) {
  return (
    <header>
      <p className="announcement">mori 童裝商城｜陪孩子自在長大</p>
      <nav aria-label="主要導覽" className="site-nav">
        <MobileMenu ariaLabel="主要導覽" heading="選單" id="store-mobile-menu">
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
          <Link href="/#ages">依年齡</Link>
          <Link href="/#story">品牌故事</Link>
        </div>
        <div className="nav-actions desktop-navigation">
          <Link href="/login">會員登入</Link>
          <Link href="/admin">老闆後台</Link>
        </div>
      </nav>
    </header>
  )
}
