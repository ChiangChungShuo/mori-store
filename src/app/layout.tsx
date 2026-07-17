import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'mori 童裝商城',
  description: '為 0–12 歲孩子準備的日常好衣。',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  )
}
