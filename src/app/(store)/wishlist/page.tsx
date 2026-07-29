import { listProducts } from '@/features/catalog/queries'
import { WishlistList } from '@/features/wishlist/wishlist-list'

export const dynamic = 'force-dynamic'

export default async function WishlistPage() {
  const products = await listProducts({})

  return (
    <main className="section wishlist-page">
      <header className="page-heading">
        <p>saved pieces</p>
        <h1>追蹤清單</h1>
        <span>把喜歡的款式先收好，回來時能快速比較尺寸與庫存。</span>
      </header>
      <section className="wishlist-panel">
        <WishlistList products={products} />
      </section>
    </main>
  )
}
