import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="section status-page">
      <header className="page-heading">
        <p>404</p>
        <h1>找不到這個頁面</h1>
        <span>頁面可能已被移除，或連結有誤。看看其他適合孩子的日常選衣吧。</span>
      </header>
      <div className="status-page-actions">
        <Link className="button" href="/">返回首頁</Link>
        <Link className="button button-secondary" href="/products">逛逛所有商品</Link>
      </div>
    </main>
  )
}
