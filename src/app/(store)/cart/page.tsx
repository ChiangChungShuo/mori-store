import { CartPageClient } from '@/features/cart/cart-page-client'
import { getStorefrontSettings } from '@/features/checkout/settings'
import { getCurrentUser } from '@/lib/auth/require-user'
import { validateCoupon } from '@/features/checkout/coupons'
import { listProducts } from '@/features/catalog/queries'

export const dynamic = 'force-dynamic'

export default async function CartPage() {
  const [settings, user, products] = await Promise.all([
    getStorefrontSettings(),
    getCurrentUser(),
    listProducts({ inStock: true }),
  ])

  async function applyCoupon(code: string, subtotal: number) {
    'use server'
    return validateCoupon(code, subtotal)
  }

  return <CartPageClient settings={settings} isSignedIn={Boolean(user)} recommendedProducts={products.slice(0, 8)} couponAction={applyCoupon} />
}
