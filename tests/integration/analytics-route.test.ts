import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/analytics/events/route'
import { createE2EStore, getE2EStore } from '@/testing/e2e-store'

afterEach(() => vi.unstubAllEnvs())

describe('storefront analytics endpoint', () => {
  it('stores validated customer events in the shared fixture store', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('MORI_E2E_FIXTURES', '1')
    const fresh = createE2EStore()
    const store = getE2EStore()
    store.events = fresh.events
    const before = store.events.length

    const response = await POST(new Request('http://localhost/api/analytics/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        type: 'add_to_cart',
        productName: '有機棉小樹 T 恤',
        path: '/products/mori-organic-cotton-tee',
      }),
    }))

    expect(response.status).toBe(201)
    expect(store.events).toHaveLength(before + 1)
    expect(store.events.at(-1)).toEqual(expect.objectContaining({
      type: 'add_to_cart',
      productName: '有機棉小樹 T 恤',
    }))
  })

  it('rejects malformed analytics payloads', async () => {
    const response = await POST(new Request('http://localhost/api/analytics/events', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'not-a-uuid', type: 'unknown', path: 'external' }),
    }))
    expect(response.status).toBe(400)
  })

  it('stores a search term and its result count for search reporting', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('MORI_E2E_FIXTURES', '1')
    const store = getE2EStore()

    const response = await POST(new Request('http://localhost/api/analytics/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        type: 'search',
        productName: null,
        searchQuery: '洋裝',
        resultCount: 1,
        path: '/products',
      }),
    }))

    expect(response.status).toBe(201)
    expect(store.events.at(-1)).toEqual(expect.objectContaining({
      type: 'search',
      searchQuery: '洋裝',
      resultCount: 1,
    }))
  })
})
