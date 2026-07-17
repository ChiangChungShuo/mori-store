import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <main className="section">
      <header className="page-heading">
        <p>403</p>
        <h1>無權限存取</h1>
      </header>
      <p>目前的帳號沒有權限查看這個頁面。</p>
      <Link className="button" href="/">返回商城</Link>
    </main>
  )
}
