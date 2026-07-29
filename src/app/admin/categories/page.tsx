import Link from 'next/link'
import { CategoryManager } from '@/features/admin/category-manager'
import { createProductCategory, listProductCategories } from '@/features/catalog/categories'

export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage() {
  const categories = await listProductCategories()

  return (
    <main className="section admin-management-page admin-categories-page">
      <header className="admin-page-heading">
        <div><p className="eyebrow">admin / categories</p><h1>商品分類</h1></div>
        <p>集中管理前台商品導覽使用的分類，新增後即可在商品資料中選用。</p>
      </header>
      <div className="admin-category-toolbar"><Link href="/admin/products">← 返回商品與庫存</Link><span>目前共 {categories.length} 個分類</span></div>
      <CategoryManager categories={categories} createCategory={createProductCategory} />
    </main>
  )
}
