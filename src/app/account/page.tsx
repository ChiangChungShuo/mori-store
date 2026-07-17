import Link from 'next/link'

export default function AccountPage() {
  return (
    <main className="section">
      <header className="page-heading">
        <p>account</p>
        <h1>會員中心</h1>
      </header>
      <Link className="button" href="/account/orders">查看我的訂單</Link>
    </main>
  )
}
