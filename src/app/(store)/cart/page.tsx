import { CartPageClient } from '@/features/cart/cart-page-client'
import { getStorefrontSettings } from '@/features/checkout/settings'

export const dynamic = 'force-dynamic'

export default async function CartPage() {
  const settings = await getStorefrontSettings()
  return <CartPageClient settings={settings} />
}
