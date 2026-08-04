import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { signOut } from '@/features/auth/actions'
import { BrandLogo } from '@/components/brand-logo'
import { MobileMenu } from '@/components/mobile-menu'
import { AdminNav } from '@/features/admin/admin-nav'
import { AdminConfirmGuard } from '@/features/admin/admin-confirm-guard'
import { Toaster } from '@/components/toast'

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin()

  return (
    <div className="admin-shell">
      <header className="admin-mobile-header">
        <MobileMenu ariaLabel="商店後台導覽" breakpoint="36rem" heading="商店管理" id="admin-mobile-menu" side="left">
          <div className="admin-mobile-owner"><strong>mori 老闆</strong><small>商店管理員</small></div>
          <AdminNav />
          <div className="admin-mobile-menu-actions">
            <Link href="/">返回商城 ↗</Link>
            <form action={signOut} data-no-confirm><button type="submit">登出</button></form>
          </div>
        </MobileMenu>
        <Link aria-label="MORIMUR BABY 商店後台" className="admin-mobile-brand" href="/admin">
          <BrandLogo subtitle="store room" />
        </Link>
      </header>
      <aside className="admin-sidebar">
        <Link aria-label="MORIMUR BABY 商店後台" className="admin-brand" href="/admin"><BrandLogo subtitle="store room" /></Link>
        <div className="admin-owner"><span>店</span><div><strong>mori 老闆</strong><small>商店管理員</small></div></div>
        <AdminNav />
        <div className="admin-sidebar-actions">
          <Link href="/">返回商城 ↗</Link>
          <form action={signOut} data-no-confirm><button type="submit">登出</button></form>
        </div>
      </aside>
      <div className="admin-workspace">{children}</div>
      <AdminConfirmGuard />
      <Toaster />
    </div>
  )
}
