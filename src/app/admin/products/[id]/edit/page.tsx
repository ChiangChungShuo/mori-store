import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  deleteProductImage,
  getAdminProduct,
  setProductPublished,
  updateProduct,
  uploadProductImage,
} from '@/features/admin/product-actions'
import { ImageUploader } from '@/features/admin/image-uploader'
import { DeleteProductImageForm, ProductForm, ProductPublishForm } from '@/features/admin/product-form'
import { listProductCategories } from '@/features/catalog/categories'
import { listContentPresets } from '@/features/catalog/content-presets'
import { listProductSeries } from '@/features/catalog/product-series'

export const dynamic = 'force-dynamic'

export default async function EditAdminProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [product, categories, series, materialPresets, carePresets, sizeOptions] = await Promise.all([
    getAdminProduct(id),
    listProductCategories(),
    listProductSeries(),
    listContentPresets('material'),
    listContentPresets('care'),
    listContentPresets('size'),
  ])
  if (!product) notFound()

  const productId = product.id
  const save = updateProduct.bind(null, productId)
  const upload = uploadProductImage.bind(null, productId)
  const togglePublished = setProductPublished.bind(null, productId)
  const variantSignature = product.product.variants
    .map((variant) => `${variant.id}:${variant.updatedAt}`)
    .sort()
    .join(':')

  return (
    <main className="section admin-product-editor">
      <p className="admin-back-link"><Link href="/admin/products">← 返回商品列表</Link></p>
      <header className="admin-page-heading">
        <div><p className="eyebrow">admin / products / edit</p><h1>編輯 {product.product.name}</h1></div>
        <p>完成商品資料、圖片與庫存後，再切換前台上架狀態。</p>
      </header>
      <div className="admin-edit-status"><div><span>目前狀態</span><strong>{product.isPublished ? '已上架，顧客可以購買' : '草稿，前台不會顯示'}</strong></div><ProductPublishForm isPublished={product.isPublished} onToggle={togglePublished} /></div>
      <ProductForm key={variantSignature} carePresets={carePresets} categories={categories} initialProduct={product.product} materialPresets={materialPresets} onSave={save} series={series} sizeOptions={sizeOptions} />
      <section className="admin-product-images-section">
        <header><div><p className="eyebrow">product gallery</p><h2>商品圖片</h2></div><p>第一張圖片會作為商品列表主圖，其餘圖片會出現在商品頁輪播。</p></header>
        {product.images.length === 0 ? (
          <div className="admin-image-empty"><strong>尚未上傳圖片</strong><span>商品至少需要一張圖片才能上架。</span></div>
        ) : (
          <ul className="admin-product-image-grid">
            {product.images.map((image, index) => (
              <li key={image.id} data-primary={index === 0}>
                {index === 0 ? <span>主圖</span> : <span>{String(index + 1).padStart(2, '0')}</span>}
                <Image alt={image.alt} height={160} src={image.url} unoptimized width={128} />
                <p>{image.alt}</p>
                <DeleteProductImageForm imageNumber={index + 1} onDelete={deleteProductImage.bind(null, productId, image.id)} />
              </li>
            ))}
          </ul>
        )}
        <ImageUploader upload={upload} />
      </section>
    </main>
  )
}
