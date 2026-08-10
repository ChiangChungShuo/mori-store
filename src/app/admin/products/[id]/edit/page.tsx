import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  deleteProduct,
  deleteProductImage,
  duplicateProduct,
  getAdminProduct,
  reorderProductImages,
  setProductPublished,
  updateProduct,
  updateProductImageColor,
  uploadProductImage,
} from '@/features/admin/product-actions'
import { ImageUploader } from '@/features/admin/image-uploader'
import { ImageOrderDragArea } from '@/features/admin/image-order-drag-area'
import { DuplicateProductButton } from '@/features/admin/duplicate-product-button'
import { DeleteProductForm, DeleteProductImageForm, ProductForm, ProductImageColorForm, ProductImageOrderControls, ProductPublishForm } from '@/features/admin/product-form'
import { listProductCategories } from '@/features/catalog/categories'
import { listContentPresets } from '@/features/catalog/content-presets'
import { listProductSeries } from '@/features/catalog/product-series'
import { getProductContentSources, saveProductContentDefaults } from '@/features/admin/product-content-defaults'

export const dynamic = 'force-dynamic'

export default async function EditAdminProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [product, categories, series, materialPresets, carePresets, sizeOptions, contentSources] = await Promise.all([
    getAdminProduct(id),
    listProductCategories(),
    listProductSeries(),
    listContentPresets('material'),
    listContentPresets('care'),
    listContentPresets('size'),
    getProductContentSources(),
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
  const imageIds = product.images.map((image) => image.id)
  const colors = [...new Set(product.product.variants.map((variant) => variant.color))]
  const moveImage = (index: number, offset: -1 | 1) => {
    const reordered = [...imageIds]
    ;[reordered[index], reordered[index + offset]] = [reordered[index + offset], reordered[index]]
    return reordered
  }

  return (
    <main className="section admin-product-editor">
      <p className="admin-back-link"><Link href="/admin/products">← 返回商品列表</Link></p>
      <header className="admin-page-heading">
        <div><p className="eyebrow">admin / products / edit</p><h1>編輯 {product.product.name}</h1></div>
        <p>完成商品資料、圖片與庫存後，再切換前台上架狀態。</p>
      </header>
      <div className="admin-edit-status"><div><span>目前狀態</span><strong>{product.isPublished ? '已上架，顧客可以購買' : '草稿，前台不會顯示'}</strong></div><div className="admin-edit-status-actions"><DuplicateProductButton duplicate={duplicateProduct.bind(null, productId)} productName={product.product.name} /><ProductPublishForm isPublished={product.isPublished} onToggle={togglePublished} /></div></div>
      <ProductForm key={variantSignature} carePresets={carePresets} categories={categories} contentSources={contentSources} initialProduct={product.product} materialPresets={materialPresets} onSave={save} saveContentDefaults={saveProductContentDefaults} series={series} sizeOptions={sizeOptions} />
      <section className="admin-product-images-section">
        <header><div><p className="eyebrow">product gallery</p><h2>商品圖片</h2></div><p>第一張圖片會作為商品列表主圖，其餘圖片會出現在商品頁輪播。</p></header>
        {product.images.length > 1 ? <p className="admin-image-drag-hint">用滑鼠拖曳圖片就能調整順序，放開即儲存；也可以按圖片左右兩側的箭頭移動。</p> : null}
        {product.images.length === 0 ? (
          <div className="admin-image-empty"><strong>尚未上傳圖片</strong><span>商品至少需要一張圖片才能上架。</span></div>
        ) : (
          <ImageOrderDragArea reorder={reorderProductImages.bind(null, productId)}>
            {product.images.map((image, index) => (
              <li data-image-id={image.id} data-primary={index === 0} draggable key={image.id}>
                {index === 0 ? <span>主圖</span> : <span>{String(index + 1).padStart(2, '0')}</span>}
                {product.images.length > 1 ? <span className="admin-image-grip"><svg aria-hidden="true" fill="none" height="10" viewBox="0 0 10 10" width="10"><circle cx="3" cy="2" r="1" fill="currentColor" /><circle cx="7" cy="2" r="1" fill="currentColor" /><circle cx="3" cy="5" r="1" fill="currentColor" /><circle cx="7" cy="5" r="1" fill="currentColor" /><circle cx="3" cy="8" r="1" fill="currentColor" /><circle cx="7" cy="8" r="1" fill="currentColor" /></svg>拖曳</span> : null}
                <div className="admin-image-frame">
                  <Image alt={image.alt} draggable={false} height={160} src={image.url} unoptimized width={128} />
                  <ProductImageOrderControls
                    imageNumber={index + 1}
                    onMoveEarlier={index > 0 ? reorderProductImages.bind(null, productId, moveImage(index, -1)) : undefined}
                    onMoveLater={index < product.images.length - 1 ? reorderProductImages.bind(null, productId, moveImage(index, 1)) : undefined}
                  />
                </div>
                <p>{image.alt}</p>
                <ProductImageColorForm
                  imageNumber={index + 1}
                  color={image.color}
                  colors={colors}
                  onSave={updateProductImageColor.bind(null, productId, image.id)}
                />
                <DeleteProductImageForm imageNumber={index + 1} onDelete={deleteProductImage.bind(null, productId, image.id)} />
              </li>
            ))}
          </ImageOrderDragArea>
        )}
        <ImageUploader colors={colors} upload={upload} />
      </section>
      <section className="admin-danger-zone">
        <div><strong>刪除這個商品</strong><p>刪除後無法復原；若只是暫時不賣，請改用上方的下架切換。</p></div>
        <DeleteProductForm label="刪除商品" onDelete={deleteProduct.bind(null, productId)} redirectTo="/admin/products" />
      </section>
    </main>
  )
}
