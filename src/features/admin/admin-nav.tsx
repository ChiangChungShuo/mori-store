'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Admin sections. Icons replace the single-character placeholders, and the
// current section is highlighted so it is always clear where you are.
const sections = [
  { href: '/admin', label: '商店總覽', icon: <path d="M3.2 9.2 10 3.6l6.8 5.6M5 8.6V16h10V8.6" /> },
  { href: '/admin/orders', label: '訂單管理', icon: <path d="M5 2.8h10v14.4l-2.5-1.6-2.5 1.6-2.5-1.6L5 17.2ZM7.6 7h4.8M7.6 10.4h4.8" /> },
  { href: '/admin/products', label: '商品與庫存', icon: <path d="M10 2.8 16.8 6v8L10 17.2 3.2 14V6ZM3.2 6 10 9.2 16.8 6M10 9.2v8" /> },
  { href: '/admin/categories', label: '商品分類', icon: <path d="M3.4 4.4h5.2v5.2H3.4zM11.4 4.4h5.2v5.2h-5.2zM3.4 10.4h5.2v5.2H3.4zM11.4 10.4h5.2v5.2h-5.2z" /> },
  { href: '/admin/members', label: '會員管理', icon: <path d="M7.6 9a2.6 2.6 0 1 0 0-5.2A2.6 2.6 0 0 0 7.6 9ZM2.6 16.4c.5-3 2.3-4.5 5-4.5s4.5 1.5 5 4.5M13 4.2a2.4 2.4 0 0 1 0 4.6M14.4 11.7c1.6.5 2.6 1.8 3 4.1" /> },
  { href: '/admin/marketing', label: '行銷推廣', icon: <path d="M4 8.2 15.4 4.2v11.6L4 11.8ZM4 8.2H2.8v3.6H4M6.6 12.4v3.4h2.2" /> },
  { href: '/admin/reports', label: '報表分析', icon: <path d="M3.4 16.6h13.2M6 16.4V9.6M10 16.4V4.4M14 16.4v-4.8" /> },
  { href: '/admin/settings', label: '商店設定', icon: <path d="M3.4 6.4h5.2M12.2 6.4h4.4M3.4 13.6h4.4M11.4 13.6h5.2M10.4 4.4v4M9.6 11.6v4" /> },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="admin-nav" aria-label="商店後台導覽">
      {sections.map((section) => {
        const active = section.href === '/admin'
          ? pathname === '/admin'
          : pathname.startsWith(section.href)
        return (
          <Link aria-current={active ? 'page' : undefined} href={section.href} key={section.href}>
            <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">{section.icon}</svg>
            {section.label}
          </Link>
        )
      })}
    </nav>
  )
}
