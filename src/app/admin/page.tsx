import Link from 'next/link'
import { getDashboardMetrics } from '@/features/admin/dashboard-queries'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const { todayOrders, fulfillmentBacklog, lowStockVariants } = await getDashboardMetrics()

  return (
    <main className="section">
      <header className="page-heading">
        <p>admin</p>
        <h1>商店後台</h1>
      </header>
      <div className="product-grid">
        <article className="product-card"><div className="product-card-body"><h2>今日訂單</h2><p>{todayOrders}</p></div></article>
        <article className="product-card"><div className="product-card-body"><h2>待處理訂單</h2><p>{fulfillmentBacklog}</p><small>已付款與備貨中</small></div></article>
        <article className="product-card"><div className="product-card-body"><h2>低庫存規格</h2><p>{lowStockVariants}</p><small>啟用中且庫存 3 件以下</small></div></article>
      </div>
      <nav className="payment-actions section-action" aria-label="後台功能">
        <Link className="button" href="/admin/orders">管理訂單</Link>
        <Link className="button" href="/admin/products">管理商品與庫存</Link>
        <Link className="button" href="/admin/settings">商店設定</Link>
      </nav>
    </main>
  )
}
