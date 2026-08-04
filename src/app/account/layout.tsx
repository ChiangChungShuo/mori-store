import Link from 'next/link'
import { AccountNav } from '@/features/account/account-nav'
import { signOut } from '@/features/auth/actions'
import { requireUser } from '@/lib/auth/require-user'
import { BrandLogo } from '@/components/brand-logo'

export default async function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser()

  return (
    <div className="account-site">
      <header className="account-topbar">
        <Link aria-label="回到 mori 首頁" className="account-logo" href="/"><BrandLogo /></Link>
        <nav aria-label="會員快速導覽"><Link href="/products">繼續選購</Link><Link href="/cart">購物車</Link></nav>
      </header>
      <div className="account-layout section">
        <aside className="account-sidebar">
          <div className="account-sidebar-user">
            <span>{(user.email ?? 'm').slice(0, 1).toUpperCase()}</span>
            <div><strong>{user.email?.split('@')[0] ?? 'mori 會員'}</strong><small>{user.email}</small></div>
          </div>
          <AccountNav />
          <form action={signOut}>
            <button type="submit">登出</button>
          </form>
        </aside>
        <div className="account-content">{children}</div>
      </div>
    </div>
  )
}
