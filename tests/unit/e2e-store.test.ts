import { describe, expect, it } from 'vitest'
import { isE2EMode } from '@/testing/e2e-mode'
import { createE2EStore } from '@/testing/e2e-store'

describe('local fixture store', () => {
  it('enables fixtures locally with the explicit flag and on Vercel previews', () => {
    expect(isE2EMode({ NODE_ENV: 'development', MORI_E2E_FIXTURES: '1' })).toBe(true)
    expect(isE2EMode({ NODE_ENV: 'production', MORI_E2E_FIXTURES: '1' })).toBe(false)
    expect(isE2EMode({ NODE_ENV: 'production', VERCEL_ENV: 'preview' })).toBe(true)
    expect(isE2EMode({ NODE_ENV: 'production', VERCEL_ENV: 'production' })).toBe(false)
    expect(isE2EMode({ NODE_ENV: 'development' })).toBe(false)
  })

  it('creates independent stores with the admin seed and an order seed', () => {
    const first = createE2EStore()
    const second = createE2EStore()
    first.sessions.set('session-a', { userId: 'admin', createdAt: new Date().toISOString() })
    expect(second.sessions.size).toBe(0)
    expect([...first.users.values()]).toContainEqual(expect.objectContaining({
      email: 'admin@mori.tw', role: 'admin',
    }))
    expect(first.orders.size).toBeGreaterThan(0)
  })
})
