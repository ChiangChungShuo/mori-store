import Link from 'next/link'

export default function AdminPage() {
  return (
    <main className="section">
      <header className="page-heading">
        <p>admin</p>
        <h1>商店後台</h1>
      </header>
      <Link className="button" href="/admin/products">管理商品與庫存</Link>
    </main>
  )
}
