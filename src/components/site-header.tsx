import Link from 'next/link'

export function SiteHeader() {
  return (
    <header>
      <p className="announcement">mori 童裝商城｜陪孩子自在長大</p>
      <nav aria-label="主要導覽" className="site-nav">
        <Link href="/" className="brand">mori</Link>
        <div className="nav-links">
          <Link href="#new">新品</Link>
          <Link href="#ages">依年齡</Link>
          <Link href="#story">品牌故事</Link>
        </div>
      </nav>
    </header>
  )
}
