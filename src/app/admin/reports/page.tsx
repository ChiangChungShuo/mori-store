import Link from 'next/link'
import { getSalesReport, parseReportRange, reportRanges, reportRangeStart } from '@/features/admin/business-management'
import { getCommerceInsights } from '@/features/admin/commerce-insights'
import { listAdminProducts } from '@/features/admin/product-actions'
import { listPendingRestockCounts } from '@/features/catalog/restock-requests'
import { listProductViewCounts } from '@/features/admin/product-views'
import { formatTwd } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = parseReportRange((await searchParams).range)
  const since = reportRangeStart(range)
  const [report, insights, products, pendingRestocks, viewCounts] = await Promise.all([
    getSalesReport(range.period, { since }),
    getCommerceInsights({ since }),
    listAdminProducts(),
    listPendingRestockCounts(),
    listProductViewCounts(range.days ?? 365),
  ])
  // Views live on the slug; sales come back by product name, so the join is by
  // name and simply reads 0 for a product renamed since its last order.
  const soldByName = new Map(report.products.map((product) => [product.name, product.quantity]))
  const productsBySlug = new Map(products.map((product) => [product.slug, product]))
  const viewRanking = viewCounts
    .map((entry) => {
      const product = productsBySlug.get(entry.slug)
      return product
        ? { ...entry, name: product.name, id: product.id, sold: soldByName.get(product.name) ?? 0 }
        : null
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .slice(0, 8)
  const totalViews = viewCounts.reduce((total, entry) => total + entry.views, 0)
  const waitingByProduct = new Map(pendingRestocks.map((entry) => [entry.productId, entry.count]))
  const waitingTotal = pendingRestocks.reduce((total, entry) => total + entry.count, 0)
  const average = report.orderCount ? Math.round(report.revenue / report.orderCount) : 0
  const maxRevenue = Math.max(...report.periods.map((period) => period.revenue), 1)
  const replenishment = products.filter((product) => product.totalStock <= 5).sort((left, right) => left.totalStock - right.totalStock)

  return (
    <main className="section admin-management-page">
      <header className="admin-page-heading">
        <div><p className="eyebrow">sales intelligence</p><h1>報表分析</h1></div>
        <div className="report-heading-actions">
          <nav aria-label="統計期間" className="report-tabs">{reportRanges.map((option) => (
            <Link aria-current={option.key === range.key ? 'page' : undefined} href={`/admin/reports?range=${option.key}`} key={option.key}>{option.label}</Link>
          ))}</nav>
          <a className="admin-inline-action" download href={`/admin/reports/export?range=${range.key}`}>匯出 CSV</a>
        </div>
      </header>

      {/* Four headline numbers only. 造訪／加購／開始結帳 are already listed
          stage by stage in the funnel panel, and 需要補貨 is the stock panel's
          own count, so a second metric row was pure duplication. */}
      <section className="admin-metrics admin-metrics-wide">
        <article className="metric-feature"><p>有效營收</p><strong>{formatTwd(report.revenue)}</strong><small>{range.label}・排除待付款與取消訂單</small></article>
        <article><p>訂單數</p><strong>{report.orderCount}</strong><small>已付款以上</small></article>
        <article><p>平均客單價</p><strong>{formatTwd(average)}</strong><small>有效營收 ÷ 訂單</small></article>
        <article>
          <p>商品毛利（估算）</p>
          <strong>{report.costedRevenue > 0 ? formatTwd(report.grossProfit) : '—'}</strong>
          <small>{report.costedRevenue > 0
            ? `毛利率 ${report.marginRate}%${report.costCoverage < 100 ? `・僅含有成本的 ${report.costCoverage}% 商品` : '・以目前成本計算'}`
            : '在商品規格填成本後開始計算'}</small>
        </article>
        <article><p>購物車放棄率</p><strong>{insights.cartAbandonmentRate}%</strong><small>加入購物車但未完成購買</small></article>
      </section>

      <div className="admin-dashboard-grid report-grid">
        <section className="admin-panel">
          <header><div><p className="eyebrow">revenue trend</p><h2>{range.period === 'day' ? '每日' : '每月'}銷售</h2></div><p>{range.label}</p></header>
          {report.periods.length === 0 ? <p className="report-empty">這段期間還沒有有效訂單，換個期間或等第一筆訂單進來。</p> : <div className="report-bars">{report.periods.map((period) => <div className="report-bar-row" key={period.label}><span>{period.label}</span><div><i style={{ width: `${Math.max((period.revenue / maxRevenue) * 100, 2)}%` }} /></div><strong>{formatTwd(period.revenue)}</strong><small>{period.orders} 筆</small></div>)}</div>}
        </section>
        <section className="admin-panel">
          <header><div><p className="eyebrow">best sellers</p><h2>熱銷商品</h2></div><p>{report.costedRevenue > 0 ? '毛利以商品目前的成本估算' : '在商品規格填成本後會顯示毛利'}</p></header>
          {report.products.length === 0 ? <p className="report-empty">這段期間還沒有售出商品。</p> : <ol className="report-product-list">{report.products.map((product, index) => <li key={product.name}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{product.name}</strong><small>銷售 {product.quantity} 件{product.profit === null ? '' : `・毛利 ${formatTwd(product.profit)}`}</small></div><em>{formatTwd(product.revenue)}</em></li>)}</ol>}
        </section>

        <section className="admin-panel report-funnel-panel">
          <header><div><p className="eyebrow">purchase funnel</p><h2>購買轉換漏斗</h2></div><p>從商品瀏覽到完成購買，找出流失最多的步驟</p></header>
          <ol className="purchase-funnel">{insights.purchaseFunnel.map((stage, index) => <li key={stage.key}><div><span>{String(index + 1).padStart(2, '0')}</span><strong>{stage.label}</strong><small>{stage.sessions} 個工作階段</small></div><div className="purchase-funnel-track"><i style={{ width: `${Math.max(stage.rate, stage.sessions ? 4 : 0)}%` }} /></div><em>{stage.rate}%</em></li>)}</ol>
        </section>

        <section className="admin-panel report-stock-panel">
          <header><div><p className="eyebrow">stock alert</p><h2>庫存補貨提醒</h2></div><p>{waitingTotal > 0 ? `有 ${waitingTotal} 人登記到貨通知，補貨後系統會自動寄信` : '優先處理售完與低庫存商品'}</p></header>
          {replenishment.length === 0 ? <p className="report-empty">目前所有商品庫存都高於 5 件。</p> : <ol className="stock-alert-list">{replenishment.map((product) => <li key={product.id}><div><strong>{product.name}</strong><small>{waitingByProduct.get(product.id) ? `${waitingByProduct.get(product.id)} 人在等補貨` : product.isPublished ? '前台上架中' : '目前為草稿'}</small></div><span data-empty={product.totalStock === 0}>{product.totalStock === 0 ? '已售完' : `剩 ${product.totalStock} 件`}</span><Link href={`/admin/products/${product.id}/edit`}>調整庫存</Link></li>)}</ol>}
        </section>

        <section className="admin-panel report-views-panel">
          <header><div><p className="eyebrow">product views</p><h2>商品瀏覽排行</h2></div><p>{range.label}共 {totalViews} 次瀏覽；看得多卻沒賣出的商品，通常是價格、照片或說明需要調整</p></header>
          {viewRanking.length === 0 ? <p className="report-empty">還沒有商品瀏覽紀錄，前台有人逛之後就會出現。</p> : (
            <ol className="report-product-list">
              {viewRanking.map((entry, index) => (
                <li key={entry.slug}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{entry.name}</strong>
                    <small>{entry.views} 次瀏覽・{entry.sessions} 人{entry.sold > 0 ? `・售出 ${entry.sold} 件` : '・尚未售出'}</small>
                  </div>
                  <Link className="admin-inline-action" href={`/admin/products/${entry.id}/edit`}>編輯</Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="admin-panel report-search-panel">
          <header><div><p className="eyebrow">onsite search</p><h2>網站搜尋成效</h2></div><p>用零結果與點閱率調整商品命名</p></header>
          {insights.searchTerms.length === 0 ? <p className="report-empty">顧客在商品頁搜尋後，關鍵字成效會顯示在這裡。</p> : <div className="admin-table-scroll"><table className="admin-product-table"><thead><tr><th>關鍵字</th><th>搜尋次數</th><th>零結果</th><th>搜尋後商品點閱</th></tr></thead><tbody>{insights.searchTerms.map((term) => <tr key={term.query}><th>{term.query}</th><td>{term.searches}</td><td>{term.zeroResults}</td><td>{term.clickThroughRate}%</td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </main>
  )
}
