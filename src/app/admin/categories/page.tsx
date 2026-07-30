import Link from 'next/link'
import { CategoryManager } from '@/features/admin/category-manager'
import { PresetManager } from '@/features/admin/preset-manager'
import { SeriesManager } from '@/features/admin/series-manager'
import { createProductCategory, deleteProductCategory, listProductCategories } from '@/features/catalog/categories'
import { createContentPresetFromForm, deleteContentPresetFromForm, listContentPresets } from '@/features/catalog/content-presets'
import { createProductSeriesFromForm, deleteProductSeriesFromForm, listProductSeries, moveProductSeriesFromForm } from '@/features/catalog/product-series'

export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage() {
  const [categories, series, materialPresets, carePresets, sizePresets] = await Promise.all([
    listProductCategories(),
    listProductSeries(),
    listContentPresets('material'),
    listContentPresets('care'),
    listContentPresets('size'),
  ])

  return (
    <main className="section admin-management-page admin-categories-page">
      <header className="admin-page-heading">
        <div><p className="eyebrow">admin / catalog</p><h1>商品分類與預設值</h1></div>
        <p>集中管理前台分類，以及新增商品時可一鍵帶入的材質與洗滌說明。</p>
      </header>
      <div className="admin-category-toolbar"><Link href="/admin/products">← 返回商品與庫存</Link><span>目前共 {categories.length} 個分類</span></div>
      <CategoryManager categories={categories} createCategory={createProductCategory} deleteCategory={deleteProductCategory} />
      <SeriesManager categories={categories} series={series} createSeries={createProductSeriesFromForm} moveSeries={moveProductSeriesFromForm} deleteSeries={deleteProductSeriesFromForm} />
      <PresetManager kind="size" title="尺寸選項" placeholder="例：150 或 XS" presets={sizePresets} createAction={createContentPresetFromForm} deleteAction={deleteContentPresetFromForm} />
      <PresetManager kind="material" title="常用材質" placeholder="例：100% 有機棉" presets={materialPresets} createAction={createContentPresetFromForm} deleteAction={deleteContentPresetFromForm} />
      <PresetManager kind="care" title="常用洗滌說明" placeholder="例：冷水手洗，請勿漂白" presets={carePresets} createAction={createContentPresetFromForm} deleteAction={deleteContentPresetFromForm} />
    </main>
  )
}
