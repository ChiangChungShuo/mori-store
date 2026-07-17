import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { CartDrawer } from '@/features/cart/cart-drawer'
import { CartProvider } from '@/features/cart/cart-provider'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <SiteHeader />
      <CartDrawer />
      {children}
      <SiteFooter />
    </CartProvider>
  )
}
