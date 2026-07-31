import Image from 'next/image'
import Link from 'next/link'
import { FilterClearLink } from '@/components/filter-clear-link'
import { deleteProduct, filterAdminProductSummaries, listAdminProducts, setProductPublished, type AdminProductFilters } from '@/features/admin/product-actions'
import { DeleteProductForm, ProductPublishForm } from '@/features/admin/product-form'
import { formatTwd } from '@/lib/money'
import { listProductCategories } from '@/features/catalog/categories'
import { listProductDrafts, deleteProductDraftFromForm } from '@/features/admin/product-drafts'
import { formatTaipeiDateTime } from '@/lib/date-time'

export const dynamic = 'force-dynamic'

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const status = first(params.status)
  const stock = first(params.stock)
  const filters: AdminProductFilters = {
    query: first(params.query)?.trim() ?? '',
    category: first(params.category) ?? '',
    status: status === 'published' || status === 'draft' ? status : '',
    stock: stock === 'in_stock' || stock === 'low_stock' || stock === 'sold_out' ? stock : '',
  }
  const [allProducts, categories, drafts] = await Promise.all([listAdminProducts(), listProductCategories(), listProductDrafts()])
  const products = filterAdminProductSummaries(allProducts, filters)

  return (
    <main className="section admin-management-page">
      <header className="admin-page-heading">
        <div><p className="eyebrow">admin / products</p><h1>商品與庫存</h1></div>
        <p>查看庫存、編輯商品，或直接切換前台上架狀態。</p>
      </header>
      <div className="admin-product-toolbar"><div><Link className="button" href="/admin/products/new">＋ 新增商品</Link><Link className="admin-secondary-link" href="/admin/categories">管理商品分類 →</Link></div><span>顯示 {products.length}／{allProducts.length} 件商品</span></div>
      {drafts.length > 0 ? (
        <section className="admin-draft-panel" aria-label="未完成的商品草稿">
          <header><strong>未完成草稿</strong><small>尚未建立、可隨時繼續編輯（不會顯示在前台）</small></header>
          <ul>
            {drafts.map((draft) => (
              <li key={draft.id}>
                <div><strong>{draft.label}</strong><small>最後編輯 {formatTaipeiDateTime(draft.updatedAt)}</small></div>
                <div className="admin-draft-actions">
                  <Link className="admin-inline-action" href={`/admin/products/new?draft=${draft.id}`}>繼續編輯</Link>
                  <form action={deleteProductDraftFromForm}><input name="id" type="hidden" value={draft.id} /><button className="admin-draft-delete" type="submit">刪除</button></form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <form action="/admin/products" className="admin-product-filters" key={JSON.stringify(filters)} method="get">
        <label>搜尋商品<input defaultValue={filters.query} name="query" placeholder="商品名稱" type="search" /></label>
        <label>分類<select defaultValue={filters.category} name="category"><option value="">全部分類</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <label>上架狀態<select defaultValue={filters.status} name="status"><option value="">全部狀態</option><option value="published">已上架／預約</option><option value="draft">草稿</option></select></label>
        <label>庫存<select defaultValue={filters.stock} name="stock"><option value="">全部庫存</option><option value="in_stock">有庫存</option><option value="low_stock">低庫存（1–5）</option><option value="sold_out">已售完</option></select></label>
        <div className="filter-actions"><button className="button" type="submit">套用篩選</button><FilterClearLink href="/admin/products" /></div>
      </form>
      {products.length === 0 ? (
        <p>尚未建立商品。</p>
      ) : (
        <div className="admin-table-scroll"><table className="admin-product-table">
          <thead>
            <tr>
              <th scope="col">圖片</th>
              <th scope="col">商品</th>
              <th scope="col">狀態</th>
              <th scope="col">總庫存</th>
              <th scope="col">庫存成本</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  {product.imageUrl ? (
                    <Image
                      alt={product.imageAlt}
                      height={80}
                      src={product.imageUrl}
                      unoptimized
                      width={64}
                    />
                  ) : '無圖片'}
                </td>
                <th scope="row"><span>{product.name}</span><small>{product.category}</small></th>
                <td><span className="status-badge" data-status={product.isPublished ? 'paid' : 'pending_payment'}>{product.isPublished ? (product.availableAt && new Date(product.availableAt) > new Date() ? '預約上架' : '已上架') : '草稿'}</span>{product.availableAt && new Date(product.availableAt) > new Date() ? <small className="admin-schedule-time">{new Intl.DateTimeFormat('zh-TW', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(product.availableAt))}</small> : null}</td>
                <td>
                  {product.totalStock}
                  {product.totalStock <= 5 && <strong> 低庫存</strong>}
                </td>
                <td>{formatTwd(product.inventoryCost)}</td>
                <td><div className="admin-product-actions"><Link className="admin-inline-action" href={`/admin/products/${product.id}/edit`}>編輯</Link><ProductPublishForm compact isPublished={product.isPublished} onToggle={setProductPublished.bind(null, product.id)} /><DeleteProductForm onDelete={deleteProduct.bind(null, product.id)} /></div></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </main>
  )
}
