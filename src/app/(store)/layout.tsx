import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { BackToTop } from '@/components/back-to-top'
import { CartDrawer } from '@/features/cart/cart-drawer'
import { CartProvider } from '@/features/cart/cart-provider'
import { WishlistAuthProvider } from '@/features/wishlist/wishlist-auth'
import { getStorefrontSettings } from '@/features/checkout/settings'
import { StorefrontTracker } from '@/features/analytics/storefront-tracker'
import { getCurrentUser } from '@/lib/auth/require-user'
import { isCurrentUserAdmin } from '@/lib/auth/require-admin'
import { listProductCategories } from '@/features/catalog/categories'
import { GoogleAnalytics } from '@/components/google-analytics'
import { getPublicSiteSettings } from '@/features/admin/settings-actions'
import { listProductSeries } from '@/features/catalog/product-series'
import { getQuantityPriceMap } from '@/features/catalog/quantity-prices'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, user, isAdmin, categories, series, { googleAnalyticsId }, quantityTiers] = await Promise.all([getStorefrontSettings(), getCurrentUser(), isCurrentUserAdmin(), listProductCategories(), listProductSeries(), getPublicSiteSettings(), getQuantityPriceMap()])

  return (
    <CartProvider quantityTiers={quantityTiers}>
      <WishlistAuthProvider isSignedIn={Boolean(user)}>
        <GoogleAnalytics measurementId={googleAnalyticsId} />
        <StorefrontTracker />
        <SiteHeader cart={<CartDrawer settings={settings} isSignedIn={Boolean(user)} />} categories={categories} freeShippingThreshold={settings.freeShippingThreshold} series={series} isSignedIn={Boolean(user)} isAdmin={isAdmin} />
        {children}
        <SiteFooter isSignedIn={Boolean(user)} />
        <BackToTop />
      </WishlistAuthProvider>
    </CartProvider>
  )
}
