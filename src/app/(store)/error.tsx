'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="section status-page">
      <header className="page-heading">
        <p>oops</p>
        <h1>頁面暫時無法顯示</h1>
        <span>系統好像打了個小盹。請稍後再試一次，或回到首頁繼續逛逛。</span>
      </header>
      <div className="status-page-actions">
        <button className="button" onClick={reset} type="button">重新載入</button>
        <Link className="button button-secondary" href="/">返回首頁</Link>
      </div>
    </main>
  )
}
