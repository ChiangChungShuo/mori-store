import Link from 'next/link'
import { createProductWithImage } from '@/features/admin/product-actions'
import { ProductForm } from '@/features/admin/product-form'
import type { ProductInput } from '@/lib/validation/product'
import { listProductCategories } from '@/features/catalog/categories'
import { listContentPresets } from '@/features/catalog/content-presets'
import { DRAFT_IMAGES_KEY, DRAFT_IMAGE_ALT_KEY, discardProductDraft, getProductDraft, saveProductDraft } from '@/features/admin/product-drafts'
import { listProductSeries } from '@/features/catalog/product-series'

const newProduct: ProductInput = {
  name: '',
  slug: '',
  category: '',
  seriesIds: [],
  ageBands: [],
  description: '',
  material: '',
  careInstructions: '',
  sizeGuide: '',
  isNew: false,
  variants: [{ sku: '', color: '', size: '', price: 0, cost: 0, stock: 0 }],
  quantityPrices: [],
}

type NewProductPageProps = {
  searchParams: Promise<{ draft?: string }>
}

export default async function NewAdminProductPage({ searchParams }: NewProductPageProps) {
  const { draft: draftId } = await searchParams
  const [categories, series, materialPresets, carePresets, sizeOptions, draftData] = await Promise.all([
    listProductCategories(),
    listProductSeries(),
    listContentPresets('material'),
    listContentPresets('care'),
    listContentPresets('size'),
    draftId ? getProductDraft(draftId) : Promise.resolve(null),
  ])
  // Split the stored draft into product fields and its saved images; the
  // image keys must not leak into the strict product schema.
  const {
    [DRAFT_IMAGES_KEY]: rawDraftImages,
    [DRAFT_IMAGE_ALT_KEY]: rawDraftImageAlt,
    ...draftProduct
  } = (draftData ?? {}) as Record<string, unknown>
  const initialProduct: ProductInput = draftData
    ? { ...newProduct, ...(draftProduct as Partial<ProductInput>) }
    : newProduct
  const draftImages = Array.isArray(rawDraftImages)
    ? rawDraftImages.filter((url): url is string => typeof url === 'string')
    : []
  const draftImageAlt = typeof rawDraftImageAlt === 'string' ? rawDraftImageAlt : ''

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
        draftImageAlt={draftImageAlt}
        draftImages={draftImages}
        discardDraft={discardProductDraft}
        initialProduct={initialProduct}
        materialPresets={materialPresets}
        onSave={createProductWithImage}
        requireImage
        saveDraft={saveProductDraft}
        series={series}
        sizeOptions={sizeOptions}
      />
    </main>
  )
}
