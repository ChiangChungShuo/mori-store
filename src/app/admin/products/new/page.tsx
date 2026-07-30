import Link from 'next/link'
import { createProductWithImage } from '@/features/admin/product-actions'
import { ProductForm } from '@/features/admin/product-form'
import type { ProductInput } from '@/lib/validation/product'
import { listProductCategories } from '@/features/catalog/categories'
import { listContentPresets } from '@/features/catalog/content-presets'
import { getProductDraft, saveProductDraft } from '@/features/admin/product-drafts'

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

type NewProductPageProps = {
  searchParams: Promise<{ draft?: string }>
}

export default async function NewAdminProductPage({ searchParams }: NewProductPageProps) {
  const { draft: draftId } = await searchParams
  const [categories, materialPresets, carePresets, sizeOptions, draftData] = await Promise.all([
    listProductCategories(),
    listContentPresets('material'),
    listContentPresets('care'),
    listContentPresets('size'),
    draftId ? getProductDraft(draftId) : Promise.resolve(null),
  ])
  const initialProduct: ProductInput = draftData
    ? { ...newProduct, ...(draftData as Partial<ProductInput>) }
    : newProduct

  return (
    <main className="section admin-product-editor">
      <p className="admin-back-link"><Link href="/admin/products">← 返回商品列表</Link></p>
      <header className="admin-page-heading">
        <div><p className="eyebrow">admin / products / new</p><h1>{draftData ? '繼續編輯草稿' : '新增商品'}</h1></div>
        <p>可先「儲存草稿」（不需填完整、不會上架），之後從商品列表的草稿區繼續編輯；完成後再送出建立。</p>
      </header>
      <ProductForm
        carePresets={carePresets}
        categories={categories}
        draftId={draftData ? draftId : null}
        initialProduct={initialProduct}
        materialPresets={materialPresets}
        onSave={createProductWithImage}
        requireImage
        saveDraft={saveProductDraft}
        sizeOptions={sizeOptions}
      />
    </main>
  )
}
