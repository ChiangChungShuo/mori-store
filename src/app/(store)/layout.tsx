import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { CartDrawer } from '@/features/cart/cart-drawer'
import { CartProvider } from '@/features/cart/cart-provider'
import { listProductCategories } from '@/features/catalog/categories'
import { getCurrentUser } from '@/lib/auth/require-user'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [user, categories] = await Promise.all([getCurrentUser(), listProductCategories()])

  return (
    <CartProvider>
      <SiteHeader categories={categories} isSignedIn={Boolean(user)} />
      <CartDrawer />
      {children}
      <SiteFooter />
    </CartProvider>
  )
}
