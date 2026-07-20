import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin()

  return (
    <>
      <nav className="admin-nav" aria-label="商店後台導覽">
        <Link href="/admin">商店總覽</Link>
        <Link href="/admin/orders">訂單管理</Link>
        <Link href="/admin/products">商品管理</Link>
        <Link href="/">返回商城</Link>
      </nav>
      {children}
    </>
  )
}
