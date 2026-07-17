import { getPublishedCartVariants } from '@/features/catalog/queries'
import { parseCartRefreshRequest, reconcileCartItems } from '@/features/cart/refresh'
import { calculateCart } from '@/features/cart/totals'
import { getStorefrontSettings } from '@/features/checkout/settings'

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
    const [snapshots, settings] = await Promise.all([
      getPublishedCartVariants(items.map((item) => item.variantId)),
      getStorefrontSettings(),
    ])
    const refreshedItems = reconcileCartItems(items, snapshots)
    const summary = calculateCart(
      refreshedItems,
      settings.shippingFee,
      settings.freeShippingThreshold,
    )
    return Response.json({ items: refreshedItems, summary })
  } catch {
    return Response.json({ error: 'Unable to refresh cart.' }, { status: 503 })
  }
}
