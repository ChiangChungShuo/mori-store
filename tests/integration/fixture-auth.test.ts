import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createE2EAuthRepository,
  getE2ECurrentUser,
  signInE2E,
  signOutE2E,
  signUpE2E,
  type CookieAdapter,
} from '@/testing/e2e-auth-repository'
import { createE2EStore } from '@/testing/e2e-store'
import { requireUser } from '@/lib/auth/require-user'

const serverCookieValues = vi.hoisted(() => new Map<string, string>())
const redirect = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get(name: string) {
      const value = serverCookieValues.get(name)
      return value ? { value } : undefined
    },
    set(name: string, value: string) {
      serverCookieValues.set(name, value)
    },
    delete(name: string) {
      serverCookieValues.delete(name)
    },
  }),
}))

vi.mock('next/navigation', () => ({ redirect }))

afterEach(() => {
  vi.unstubAllEnvs()
})

function createCookieJar() {
  const values = new Map<string, string>()
  const writes: Array<{ name: string; options: Parameters<CookieAdapter['set']>[2] }> = []
  const adapter: CookieAdapter = {
    get(name) {
      const value = values.get(name)
      return value ? { value } : undefined
    },
    set(name, value, options) {
      values.set(name, value)
      writes.push({ name, options })
    },
    delete(name) {
      values.delete(name)
    },
  }
  return { adapter, values, writes }
}

describe('fixture authentication', () => {
  it('registers and authenticates a customer without storing a plain password in sessions', async () => {
    const store = createE2EStore()
    const cookies = createCookieJar()
    const auth = createE2EAuthRepository(store, cookies.adapter)

    await expect(auth.signUp(' Parent@Example.com ', 'parent123')).resolves.toBe('created')
    await expect(auth.signUp('parent@example.com', 'parent123')).resolves.toBe('duplicate')
    await expect(auth.signIn('parent@example.com', 'wrongpass')).resolves.toBeNull()
    await expect(auth.signIn('parent@example.com', 'parent123')).resolves.toEqual(
      expect.objectContaining({ email: 'parent@example.com', role: 'customer' }),
    )
    expect(JSON.stringify([...store.sessions.values()])).not.toContain('parent123')
    expect(cookies.writes[0]).toEqual(expect.objectContaining({
      name: 'mori-demo-session',
      options: expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    }))
  })

  it('recognizes the seeded owner and clears its opaque session on sign out', async () => {
    const store = createE2EStore()
    const cookies = createCookieJar()
    const auth = createE2EAuthRepository(store, cookies.adapter)

    const user = await auth.signIn('admin@mori.tw', 'mori123456')
    expect(user?.role).toBe('admin')
    await expect(auth.currentUser()).resolves.toEqual(user)
    expect([...cookies.values.values()][0]).not.toContain('admin')

    await auth.signOut()
    await expect(auth.currentUser()).resolves.toBeNull()
    expect(store.sessions.size).toBe(0)
  })

  it('exposes server operations for fixture actions and guards', async () => {
    const email = `member-${crypto.randomUUID()}@example.com`

    await expect(signUpE2E(email, 'parent123')).resolves.toBe('created')
    await expect(signInE2E(email, 'parent123')).resolves.toMatchObject({
      email,
      role: 'customer',
    })
    await expect(getE2ECurrentUser()).resolves.toMatchObject({ email })

    await signOutE2E()
    await expect(getE2ECurrentUser()).resolves.toBeNull()
  })

  it('preserves the requested fixture pathname when authentication is required', async () => {
    vi.stubEnv('MORI_E2E_FIXTURES', '1')
    serverCookieValues.clear()
    redirect.mockClear()

    await requireUser('/account/orders')

    expect(redirect).toHaveBeenCalledWith('/login?next=%2Faccount%2Forders')
  })
})
