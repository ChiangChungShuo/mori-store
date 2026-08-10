import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/analytics/events/route'
import { createE2EStore, getE2EStore } from '@/testing/e2e-store'

vi.stubEnv('MORI_E2E_FIXTURES', '1')

function post(body: unknown, ip = '10.0.0.1') {
  return POST(new Request('http://localhost/api/analytics/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  }))
}

const validEvent = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  type: 'search' as const,
  productName: null,
  path: '/products',
  searchQuery: '洋裝',
  resultCount: 3,
}

beforeEach(() => {
  Object.assign(getE2EStore(), createE2EStore())
})

describe('POST /api/analytics/events', () => {
  it('accepts a plain storefront search', async () => {
    const response = await post(validEvent, '10.0.0.2')

    expect(response.status).toBe(201)
    expect(getE2EStore().events.at(-1)).toMatchObject({ type: 'search', searchQuery: '洋裝' })
  })

  it('rejects search terms that carry markup or links', async () => {
    // These strings are shown back to shoppers on the zero-result page.
    const markup = await post({ ...validEvent, searchQuery: '<b>買</b>' }, '10.0.0.3')
    const link = await post({ ...validEvent, searchQuery: 'https://spam.example' }, '10.0.0.4')
    const long = await post({ ...validEvent, searchQuery: '童'.repeat(40) }, '10.0.0.5')

    expect([markup.status, link.status, long.status]).toEqual([400, 400, 400])
    // The seeded fixture events stay; nothing from these requests was written.
    const queries = getE2EStore().events.map((event) => event.searchQuery)
    expect(queries.some((query) => query?.includes('<b>') || query?.includes('spam'))).toBe(false)
  })

  it('rate limits a client that floods the endpoint', async () => {
    const flooder = '10.0.0.6'
    const statuses: number[] = []
    for (let attempt = 0; attempt < 70; attempt += 1) {
      statuses.push((await post(validEvent, flooder)).status)
    }

    expect(statuses.filter((status) => status === 201).length).toBeLessThanOrEqual(60)
    expect(statuses).toContain(429)
    // Another visitor is unaffected by the flood.
    expect((await post(validEvent, '10.0.0.7')).status).toBe(201)
  })
})
