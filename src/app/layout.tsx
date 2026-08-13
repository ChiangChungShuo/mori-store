import type { Metadata } from 'next'
import { getPublicSiteSettings } from '@/features/admin/settings-actions'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const { siteTitle, siteDescription, siteKeywords } = await getPublicSiteSettings()
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    title: { default: siteTitle, template: `%s｜MORIMUR BABY` },
    description: siteDescription,
    keywords: siteKeywords,
    openGraph: { type: 'website', locale: 'zh_TW', siteName: 'MORIMUR BABY', title: siteTitle, description: siteDescription },
    twitter: { card: 'summary_large_image', title: siteTitle, description: siteDescription },
  }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="zh-Hant" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
