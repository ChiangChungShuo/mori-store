import { listProducts } from '@/features/catalog/queries'
import { getStoreSettings } from '@/features/admin/settings-actions'
import { WishlistList } from '@/features/wishlist/wishlist-list'

export const dynamic = 'force-dynamic'

export default async function WishlistPage() {
  const [products, settings] = await Promise.all([listProducts({}), getStoreSettings()])

  return (
    <main className="section wishlist-page">
      <header className="page-heading">
        <p>saved pieces</p>
        <h1>追蹤清單</h1>
        <span>收藏的款式都在這裡，直接在卡片上選尺寸就能加入購物車。</span>
      </header>
      <WishlistList freeShippingThreshold={settings.freeShippingThreshold} products={products} />
    </main>
  )
}
