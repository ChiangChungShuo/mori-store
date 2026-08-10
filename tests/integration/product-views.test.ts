import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listProductViewCounts } from '@/features/admin/product-views'
import { createE2EStore, getE2EStore } from '@/testing/e2e-store'

vi.stubEnv('MORI_E2E_FIXTURES', '1')
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: async () => ({ id: 'admin' }) }))

function view(path: string, sessionId: string, daysAgo = 0) {
  return {
    sessionId,
    type: 'product_view' as const,
    productName: null,
    path,
    createdAt: new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString(),
  }
}

beforeEach(() => {
  Object.assign(getE2EStore(), createE2EStore())
  getE2EStore().events.length = 0
})

describe('listProductViewCounts', () => {
  it('counts views and distinct visitors per product', async () => {
    getE2EStore().events.push(
      view('/products/mori-tree-tee', 'session-a'),
      view('/products/mori-tree-tee', 'session-a'),
      view('/products/mori-tree-tee', 'session-b'),
      view('/products/mori-cloud-romper', 'session-b'),
    )

    const counts = await listProductViewCounts(30)

    expect(counts).toEqual([
      { slug: 'mori-tree-tee', views: 3, sessions: 2 },
      { slug: 'mori-cloud-romper', views: 1, sessions: 1 },
    ])
  })

  it('ignores events outside the window and paths that are not products', async () => {
    getE2EStore().events.push(
      view('/products/mori-tree-tee', 'session-a', 40),
      view('/cart', 'session-a'),
      view('/products/mori-cloud-romper?color=x', 'session-c'),
    )

    const counts = await listProductViewCounts(30)

    // The query string is not part of the slug, and /cart is not a product.
    expect(counts).toEqual([{ slug: 'mori-cloud-romper', views: 1, sessions: 1 }])
  })
})
