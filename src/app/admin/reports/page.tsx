import Link from 'next/link'
import { getSalesReport } from '@/features/admin/business-management'
import { getCommerceInsights } from '@/features/admin/commerce-insights'
import { listAdminProducts } from '@/features/admin/product-actions'
import { formatTwd } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view === 'month' ? 'month' : 'day'
  const [report, insights, products] = await Promise.all([getSalesReport(view), getCommerceInsights(), listAdminProducts()])
  const average = report.orderCount ? Math.round(report.revenue / report.orderCount) : 0
  const maxRevenue = Math.max(...report.periods.map((period) => period.revenue), 1)
  const replenishment = products.filter((product) => product.totalStock <= 5).sort((left, right) => left.totalStock - right.totalStock)

  return (
    <main className="section admin-management-page">
      <header className="admin-page-heading">
        <div><p className="eyebrow">sales intelligence</p><h1>報表分析</h1></div>
        <nav className="report-tabs"><Link aria-current={view === 'day' ? 'page' : undefined} href="/admin/reports?view=day">每日</Link><Link aria-current={view === 'month' ? 'page' : undefined} href="/admin/reports?view=month">每月</Link></nav>
      </header>

      <section className="admin-metrics admin-metrics-compact">
        <article className="metric-feature"><p>有效營收</p><strong>{formatTwd(report.revenue)}</strong><small>排除待付款與取消訂單</small></article>
        <article><p>訂單數</p><strong>{report.orderCount}</strong><small>已付款以上</small></article>
        <article><p>平均客單價</p><strong>{formatTwd(average)}</strong><small>有效營收 ÷ 訂單</small></article>
      </section>

      <section className="admin-metrics admin-traffic-metrics" aria-label="營運數據摘要">
        <article><p>造訪人數</p><strong>{insights.uniqueVisitors}</strong><small>不重複的瀏覽工作階段</small></article>
        <article><p>加入購物車</p><strong>{insights.purchaseFunnel[1].sessions}</strong><small>有加入商品的購物工作階段</small></article>
        <article><p>開始結帳</p><strong>{insights.purchaseFunnel[2].sessions}</strong><small>已進入填寫資料流程</small></article>
        <article><p>購物車放棄率</p><strong>{insights.cartAbandonmentRate}%</strong><small>加入購物車但未完成購買</small></article>
        <article><p>需要補貨</p><strong>{replenishment.length}</strong><small>總庫存 5 件以下的商品</small></article>
      </section>

      <div className="admin-dashboard-grid report-grid">
        <section className="admin-panel">
          <header><div><p className="eyebrow">revenue trend</p><h2>{view === 'day' ? '每日' : '每月'}銷售</h2></div></header>
          {report.periods.length === 0 ? <p className="report-empty">有有效訂單後會顯示銷售趨勢。</p> : <div className="report-bars">{report.periods.map((period) => <div className="report-bar-row" key={period.label}><span>{period.label}</span><div><i style={{ width: `${Math.max((period.revenue / maxRevenue) * 100, 2)}%` }} /></div><strong>{formatTwd(period.revenue)}</strong><small>{period.orders} 筆</small></div>)}</div>}
        </section>
        <section className="admin-panel">
          <header><div><p className="eyebrow">best sellers</p><h2>熱銷商品</h2></div></header>
          <ol className="report-product-list">{report.products.map((product, index) => <li key={product.name}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{product.name}</strong><small>銷售 {product.quantity} 件</small></div><em>{formatTwd(product.revenue)}</em></li>)}</ol>
        </section>

        <section className="admin-panel report-funnel-panel">
          <header><div><p className="eyebrow">purchase funnel</p><h2>購買轉換漏斗</h2></div><p>從商品瀏覽到完成購買，找出流失最多的步驟</p></header>
          <ol className="purchase-funnel">{insights.purchaseFunnel.map((stage, index) => <li key={stage.key}><div><span>{String(index + 1).padStart(2, '0')}</span><strong>{stage.label}</strong><small>{stage.sessions} 個工作階段</small></div><div className="purchase-funnel-track"><i style={{ width: `${Math.max(stage.rate, stage.sessions ? 4 : 0)}%` }} /></div><em>{stage.rate}%</em></li>)}</ol>
        </section>

        <section className="admin-panel report-stock-panel">
          <header><div><p className="eyebrow">stock alert</p><h2>庫存補貨提醒</h2></div><p>優先處理售完與低庫存商品</p></header>
          {replenishment.length === 0 ? <p className="report-empty">目前所有商品庫存都高於 5 件。</p> : <ol className="stock-alert-list">{replenishment.map((product) => <li key={product.id}><div><strong>{product.name}</strong><small>{product.isPublished ? '前台上架中' : '目前為草稿'}</small></div><span data-empty={product.totalStock === 0}>{product.totalStock === 0 ? '已售完' : `剩 ${product.totalStock} 件`}</span><Link href={`/admin/products/${product.id}/edit`}>調整庫存</Link></li>)}</ol>}
        </section>

        <section className="admin-panel report-search-panel">
          <header><div><p className="eyebrow">onsite search</p><h2>網站搜尋成效</h2></div><p>用零結果與點閱率調整商品命名</p></header>
          {insights.searchTerms.length === 0 ? <p className="report-empty">顧客在商品頁搜尋後，關鍵字成效會顯示在這裡。</p> : <div className="admin-table-scroll"><table className="admin-product-table"><thead><tr><th>關鍵字</th><th>搜尋次數</th><th>零結果</th><th>搜尋後商品點閱</th></tr></thead><tbody>{insights.searchTerms.map((term) => <tr key={term.query}><th>{term.query}</th><td>{term.searches}</td><td>{term.zeroResults}</td><td>{term.clickThroughRate}%</td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </main>
  )
}
