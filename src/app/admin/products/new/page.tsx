import Link from 'next/link'
import { createProduct } from '@/features/admin/product-actions'
import { ProductForm } from '@/features/admin/product-form'
import type { ProductInput } from '@/lib/validation/product'

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
  variants: [{ sku: '', color: '', size: '', price: 0, stock: 0 }],
}

export default function NewAdminProductPage() {
  return (
    <main className="section">
      <p><Link href="/admin/products">← 返回商品列表</Link></p>
      <header className="page-heading">
        <p>admin / products / new</p>
        <h1>新增商品</h1>
      </header>
      <ProductForm initialProduct={newProduct} onSave={createProduct} />
    </main>
  )
}
