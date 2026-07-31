import { getPublishedCartVariants } from '@/features/catalog/queries'
import { parseCartRefreshRequest, reconcileCartItems } from '@/features/cart/refresh'
import { calculateCart } from '@/features/cart/totals'
import { getStorefrontSettings } from '@/features/checkout/settings'
import { getQuantityPriceMap } from '@/features/catalog/quantity-prices'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid cart refresh request.' }, { status: 400 })
  }

  const items = parseCartRefreshRequest(body)
  if (!items) {
    return Response.json({ error: 'Invalid cart refresh request.' }, { status: 400 })
  }

  try {
    const [snapshots, settings, quantityTiers] = await Promise.all([
      getPublishedCartVariants(items.map((item) => item.variantId)),
      getStorefrontSettings(),
      getQuantityPriceMap(),
    ])
    const refreshedItems = reconcileCartItems(items, snapshots)
    const totals = calculateCart(
      refreshedItems,
      settings.shippingFee,
      settings.freeShippingThreshold,
      quantityTiers,
    )
    // `bundles` is a Map of per-product detail — not JSON-serialisable and not
    // needed by the client, which only renders the aggregate discount.
    const summary = {
      subtotal: totals.subtotal,
      bundleDiscount: totals.bundleDiscount,
      discountedSubtotal: totals.discountedSubtotal,
      shipping: totals.shipping,
      total: totals.total,
    }
    return Response.json({ items: refreshedItems, summary })
  } catch {
    return Response.json({ error: 'Unable to refresh cart.' }, { status: 503 })
  }
}
