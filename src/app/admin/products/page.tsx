import Image from 'next/image'
import Link from 'next/link'
import { listAdminProducts } from '@/features/admin/product-actions'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  const products = await listAdminProducts()

  return (
    <main className="section">
      <header className="page-heading">
        <p>admin / products</p>
        <h1>商品與庫存</h1>
      </header>
      <p><Link className="button" href="/admin/products/new">新增商品</Link></p>
      {products.length === 0 ? (
        <p>尚未建立商品。</p>
      ) : (
        <table className="admin-product-table">
          <thead>
            <tr>
              <th scope="col">圖片</th>
              <th scope="col">商品</th>
              <th scope="col">狀態</th>
              <th scope="col">總庫存</th>
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
                <th scope="row">{product.name}</th>
                <td>{product.isPublished ? '已上架' : '草稿'}</td>
                <td>
                  {product.totalStock}
                  {product.totalStock <= 5 && <strong> 低庫存</strong>}
                </td>
                <td><Link href={`/admin/products/${product.id}/edit`}>編輯</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
