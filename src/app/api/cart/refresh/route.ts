import { getPublishedCartVariants } from '@/features/catalog/queries'
import { parseCartRefreshRequest, reconcileCartItems } from '@/features/cart/refresh'

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
    const snapshots = await getPublishedCartVariants(
      items.map((item) => item.variantId),
    )
    return Response.json({ items: reconcileCartItems(items, snapshots) })
  } catch {
    return Response.json({ error: 'Unable to refresh cart.' }, { status: 503 })
  }
}
