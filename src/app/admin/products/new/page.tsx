import Link from 'next/link'
import { createProductWithImage } from '@/features/admin/product-actions'
import { ProductForm } from '@/features/admin/product-form'
import type { ProductInput } from '@/lib/validation/product'
import { listProductCategories } from '@/features/catalog/categories'
import { listContentPresets } from '@/features/catalog/content-presets'

const newProduct: ProductInput = {
  name: '',
  slug: '',
  category: '',
  ageBands: [],
  description: '',
  material: '',
  careInstructions: '',
  sizeGuide: '',
  isNew: false,
  variants: [{ sku: '', color: '', size: '', price: 0, cost: 0, stock: 0 }],
}

export default async function NewAdminProductPage() {
  const [categories, materialPresets, carePresets] = await Promise.all([
    listProductCategories(),
    listContentPresets('material'),
    listContentPresets('care'),
  ])
  return (
    <main className="section admin-product-editor">
      <p className="admin-back-link"><Link href="/admin/products">← 返回商品列表</Link></p>
      <header className="admin-page-heading">
        <div><p className="eyebrow">admin / products / new</p><h1>新增商品</h1></div>
        <p>在同一頁完成商品資料、規格與主圖，送出後會建立為草稿供你確認。</p>
      </header>
      <ProductForm carePresets={carePresets} categories={categories} initialProduct={newProduct} materialPresets={materialPresets} onSave={createProductWithImage} requireImage />
    </main>
  )
}
