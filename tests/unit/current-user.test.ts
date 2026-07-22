import { afterEach, describe, expect, it, vi } from 'vitest'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { getCurrentUser } from '@/lib/auth/require-user'

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('getCurrentUser configuration', () => {
  it('returns null without constructing Supabase during local development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '')

    await expect(getCurrentUser()).resolves.toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('fails closed when production credentials are missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '')

    await expect(getCurrentUser()).rejects.toThrow(
      'MORI auth configuration error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.',
    )
    expect(createClient).not.toHaveBeenCalled()
  })

  it('uses Supabase when both credentials are configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-key')
    const user = { id: 'member-1' }
    const getUser = vi.fn().mockResolvedValue({ data: { user }, error: null })
    createClient.mockResolvedValue({ auth: { getUser } })

    await expect(getCurrentUser()).resolves.toBe(user)
    expect(getUser).toHaveBeenCalledOnce()
  })
})
