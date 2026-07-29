import Link from 'next/link'
import { getDashboardMetrics } from '@/features/admin/dashboard-queries'
import { getCommerceInsights } from '@/features/admin/commerce-insights'
import { listAdminOrders } from '@/features/admin/order-actions'
import { orderStatusLabels } from '@/features/orders/status'
import { formatTaipeiDateTime } from '@/lib/date-time'
import { formatTwd } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const [{ todayOrders, fulfillmentBacklog, lowStockVariants }, insights, orders] = await Promise.all([
    getDashboardMetrics(),
    getCommerceInsights(),
    listAdminOrders(),
  ])
  const statusCounts = orders.reduce<Record<string, number>>((counts, order) => {
    counts[order.status] = (counts[order.status] ?? 0) + 1
    return counts
  }, {})

  return (
    <main className="section admin-dashboard">
      <header className="admin-page-heading">
        <div><p className="eyebrow">mori store room</p><h1>今天，從訂單開始。</h1></div>
        <p>銷售與顧客動態會隨前台操作更新。</p>
      </header>

      <nav className="admin-quick-actions" aria-label="常用功能">
        <Link href="/admin/products/new"><span>＋</span><strong>新增商品</strong><small>建立價格、規格與圖片</small></Link>
        <Link href="/admin/orders"><span>訊</span><strong>回覆訂單留言</strong><small>處理顧客問題與出貨</small></Link>
        <Link href="/admin/members"><span>客</span><strong>會員資料</strong><small>查看消費與訂單紀錄</small></Link>
        <Link href="/admin/marketing"><span>促</span><strong>建立優惠</strong><small>折扣碼與行銷活動</small></Link>
        <Link href="/admin/settings"><span>頁</span><strong>編輯首頁</strong><small>輪播、SEO 與流量設定</small></Link>
      </nav>

      <section className="admin-metrics" aria-label="銷售摘要">
        <article className="metric-feature"><p>累計銷售額</p><strong>{formatTwd(insights.salesRevenue)}</strong><small>已付款以上的有效訂單</small></article>
        <article><p>訂單數</p><strong>{insights.orderCount}</strong><small>今日新增 {todayOrders} 筆</small></article>
        <article><p>平均客單價</p><strong>{formatTwd(insights.averageOrderValue)}</strong><small>每筆有效訂單</small></article>
        <article><p>購物車放棄率</p><strong>{insights.cartAbandonmentRate}%</strong><small>加購後尚未完成下單</small></article>
      </section>

      <div className="admin-dashboard-grid">
        <section className="admin-panel admin-order-pipeline">
          <header><div><p className="eyebrow">fulfillment</p><h2>訂單處理進度</h2></div><Link href="/admin/orders">查看全部</Link></header>
          <div className="order-pipeline">
            {(['pending_payment', 'paid', 'preparing', 'shipped', 'collected'] as const).map((status) => (
              <div key={status}><strong>{statusCounts[status] ?? 0}</strong><span>{orderStatusLabels[status]}</span></div>
            ))}
          </div>
          <p className="admin-panel-note">目前有 <strong>{fulfillmentBacklog}</strong> 筆已付款／備貨中訂單等待處理。</p>
        </section>

        <section className="admin-panel admin-attention">
          <header><div><p className="eyebrow">attention</p><h2>需要注意</h2></div></header>
          <Link href="/admin/orders"><strong>{fulfillmentBacklog}</strong><span>待處理訂單</span><i>→</i></Link>
          <Link href="/admin/products"><strong>{lowStockVariants}</strong><span>低庫存規格</span><i>→</i></Link>
          <div><strong>{insights.productViews}</strong><span>商品瀏覽次數</span></div>
        </section>

        <section className="admin-panel admin-recent-orders">
          <header><div><p className="eyebrow">recent orders</p><h2>最近訂單</h2></div><Link href="/admin/orders">管理訂單</Link></header>
          {orders.length === 0 ? <p>目前沒有訂單。</p> : (
            <ul>{orders.slice(0, 5).map((order) => (
              <li key={order.id}>
                <div><Link href={`/admin/orders/${order.orderNumber}`}>{order.orderNumber}</Link><span>{order.recipientName} · {formatTaipeiDateTime(order.createdAt)}</span></div>
                <strong>{formatTwd(order.total)}</strong>
                <span className="status-badge" data-status={order.status}>{orderStatusLabels[order.status]}</span>
              </li>
            ))}</ul>
          )}
        </section>

        <section className="admin-panel admin-popular-products">
          <header><div><p className="eyebrow">best sellers</p><h2>熱門商品</h2></div></header>
          {insights.popularProducts.length === 0 ? <p>完成訂單後會顯示熱門商品。</p> : (
            <ol>{insights.popularProducts.map((product, index) => (
              <li key={product.name}><span>{String(index + 1).padStart(2, '0')}</span><strong>{product.name}</strong><em>售出 {product.quantity} 件</em></li>
            ))}</ol>
          )}
        </section>
      </div>
    </main>
  )
}
