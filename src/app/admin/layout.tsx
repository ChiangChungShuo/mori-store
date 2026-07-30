import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { signOut } from '@/features/auth/actions'
import { BrandLogo } from '@/components/brand-logo'
import { MobileMenu } from '@/components/mobile-menu'
import { AdminConfirmGuard } from '@/features/admin/admin-confirm-guard'

function AdminNavigationLinks() {
  return <>
    <Link href="/admin"><span aria-hidden="true">總</span>商店總覽</Link>
    <Link href="/admin/orders"><span aria-hidden="true">單</span>訂單管理</Link>
    <Link href="/admin/products"><span aria-hidden="true">品</span>商品管理與庫存</Link>
    <Link href="/admin/categories"><span aria-hidden="true">類</span>商品分類</Link>
    <Link href="/admin/members"><span aria-hidden="true">客</span>會員管理</Link>
    <Link href="/admin/marketing"><span aria-hidden="true">促</span>行銷推廣</Link>
    <Link href="/admin/reports"><span aria-hidden="true">報</span>報表分析</Link>
    <Link href="/admin/settings"><span aria-hidden="true">設</span>商店設定</Link>
    <Link href="/"><span aria-hidden="true">↗</span>返回商城</Link>
  </>
}

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin()

  return (
    <div className="admin-shell">
      <header className="admin-mobile-header">
        <MobileMenu ariaLabel="商店後台導覽" breakpoint="36rem" heading="商店管理" id="admin-mobile-menu" side="left">
          <div className="admin-mobile-owner"><strong>mori 老闆</strong><small>商店管理員</small></div>
          <nav className="admin-mobile-nav" aria-label="手機版商店後台導覽"><AdminNavigationLinks /></nav>
          <form action={signOut} data-no-confirm><button type="submit">登出</button></form>
        </MobileMenu>
        <Link aria-label="MORIMUR BABY 商店後台" className="admin-mobile-brand" href="/admin">
          <BrandLogo subtitle="store room" />
        </Link>
        <Link aria-label="商店後台首頁" className="admin-mobile-account" href="/admin">
        </Link>
      </header>
      <aside className="admin-sidebar">
        <Link aria-label="MORIMUR BABY 商店後台" className="admin-brand" href="/admin"><BrandLogo subtitle="store room" /></Link>
        <div className="admin-owner"><span>店</span><div><strong>mori 老闆</strong><small>商店管理員</small></div></div>
        <nav className="admin-nav" aria-label="商店後台導覽"><AdminNavigationLinks /></nav>
        <div className="admin-sidebar-actions">
          <form action={signOut} data-no-confirm><button type="submit">登出</button></form>
        </div>
      </aside>
      <div className="admin-workspace">{children}</div>
      <AdminConfirmGuard />
    </div>
  )
}
