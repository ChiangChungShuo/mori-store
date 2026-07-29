import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { BackToTop } from '@/components/back-to-top'
import { CartDrawer } from '@/features/cart/cart-drawer'
import { CartProvider } from '@/features/cart/cart-provider'
import { WishlistAuthProvider } from '@/features/wishlist/wishlist-auth'
import { getStorefrontSettings } from '@/features/checkout/settings'
import { StorefrontTracker } from '@/features/analytics/storefront-tracker'
import { getCurrentUser } from '@/lib/auth/require-user'
import { listProductCategories } from '@/features/catalog/categories'
import { GoogleAnalytics } from '@/components/google-analytics'
import { getPublicSiteSettings } from '@/features/admin/settings-actions'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, user, categories, { googleAnalyticsId }] = await Promise.all([getStorefrontSettings(), getCurrentUser(), listProductCategories(), getPublicSiteSettings()])

  return (
    <CartProvider>
      <WishlistAuthProvider isSignedIn={Boolean(user)}>
        <GoogleAnalytics measurementId={googleAnalyticsId} />
        <StorefrontTracker />
        <SiteHeader cart={<CartDrawer settings={settings} />} categories={categories} isSignedIn={Boolean(user)} />
        {children}
        <SiteFooter />
        <BackToTop />
      </WishlistAuthProvider>
    </CartProvider>
  )
}
