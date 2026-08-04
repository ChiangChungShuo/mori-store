'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Member-centre navigation. The active row needs the current path, and the
// icons keep the rail readable once it collapses to a scrolling row on phones.
const items = [
  {
    href: '/account',
    label: '會員首頁',
    icon: <path d="M3.2 9.2 10 3.6l6.8 5.6M5 8.6V16h10V8.6" />,
  },
  {
    href: '/account/orders',
    label: '訂單紀錄',
    icon: <path d="M5 2.8h10v14.4l-2.5-1.6-2.5 1.6-2.5-1.6L5 17.2ZM7.6 7h4.8M7.6 10.4h4.8" />,
  },
  {
    href: '/wishlist',
    label: '追蹤清單',
    icon: <path d="M10 16.6S3.6 12.8 3.6 8.2c0-2.1 1.4-3.4 3.2-3.4 1.3 0 2.4.8 3.2 1.8.8-1 1.9-1.8 3.2-1.8 1.8 0 3.2 1.3 3.2 3.4 0 4.6-6.4 8.4-6.4 8.4Z" />,
  },
  {
    href: '/account#benefits',
    label: '會員福利',
    icon: <path d="M3.6 7.8h12.8v8.4H3.6zM3.6 7.8h12.8M10 7.8v8.4M10 7.8c-2.4 0-3.6-.5-3.6-1.9 0-1.4 1-2.1 2-2.1s1.6 1.3 1.6 4Zm0 0c2.4 0 3.6-.5 3.6-1.9 0-1.4-1-2.1-2-2.1s-1.6 1.3-1.6 4Z" />,
  },
  {
    href: '/account#profile',
    label: '基本資料',
    icon: <path d="M10 9.4a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6ZM4.4 16.6c.6-3.2 2.6-4.8 5.6-4.8s5 1.6 5.6 4.8" />,
  },
]

export function AccountNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="會員中心導覽" className="account-nav">
      {items.map((item) => {
        const isSection = item.href.includes('#')
        return (
          <Link
            aria-current={!isSection && pathname === item.href ? 'page' : undefined}
            href={item.href}
            key={item.href}
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">{item.icon}</svg>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
