import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getAdminProduct,
  setProductPublished,
  updateProduct,
  uploadProductImage,
} from '@/features/admin/product-actions'
import { ImageUploader } from '@/features/admin/image-uploader'
import { ProductForm } from '@/features/admin/product-form'

export const dynamic = 'force-dynamic'

export default async function EditAdminProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getAdminProduct(id)
  if (!product) notFound()

  const productId = product.id
  const nextPublished = !product.isPublished
  const save = updateProduct.bind(null, productId)
  const upload = uploadProductImage.bind(null, productId)

  async function togglePublished() {
    'use server'
    await setProductPublished(productId, nextPublished)
  }

  return (
    <main className="section">
      <p><Link href="/admin/products">← 返回商品列表</Link></p>
      <header className="page-heading">
        <p>admin / products / edit</p>
        <h1>編輯 {product.product.name}</h1>
      </header>
      <p>目前狀態：{product.isPublished ? '已上架' : '草稿'}</p>
      <form action={togglePublished}>
        <button type="submit">{product.isPublished ? '下架商品' : '上架商品'}</button>
      </form>
      <ProductForm initialProduct={product.product} onSave={save} />
      <section>
        <h2>商品圖片</h2>
        {product.images.length === 0 ? (
          <p>尚未上傳圖片。</p>
        ) : (
          <ul>
            {product.images.map((image) => (
              <li key={image.id}>
                <Image alt={image.alt} height={160} src={image.url} unoptimized width={128} />
                <p>{image.alt}</p>
              </li>
            ))}
          </ul>
        )}
        <ImageUploader upload={upload} />
      </section>
    </main>
  )
}
