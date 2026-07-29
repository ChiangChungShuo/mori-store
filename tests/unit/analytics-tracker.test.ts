import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trackStorefrontEvent } from '@/features/analytics/tracker'

describe('storefront analytics tracker', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a session id when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.forEach((_, index) => { bytes[index] = index + 1 })
        return bytes
      },
    })
    vi.stubGlobal('navigator', { sendBeacon: vi.fn() })

    expect(() => trackStorefrontEvent('page_view')).not.toThrow()
    expect(window.sessionStorage.getItem('mori-analytics-session-v1'))
      .toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
