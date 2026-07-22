import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createE2EAuthRepository,
  getE2ECurrentUser,
  signInE2E,
  signOutE2E,
  signUpE2E,
  type CookieAdapter,
} from '@/testing/e2e-auth-repository'
import { createE2EStore, getE2EStore } from '@/testing/e2e-store'
import {
  signIn as signInAction,
  signOut as signOutAction,
  signUp as signUpAction,
  type AuthActionState,
} from '@/features/auth/actions'
import { createPaymentAttempt } from '@/features/checkout/service'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireUser } from '@/lib/auth/require-user'

const serverCookieValues = vi.hoisted(() => new Map<string, string>())
const navigation = vi.hoisted(() => {
  const sentinel = new Error('NEXT_REDIRECT_SENTINEL')
  return {
    sentinel,
    redirect: vi.fn((destination: string) => {
      void destination
      throw sentinel
    }),
  }
})
const createClient = vi.hoisted(() => vi.fn())

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
  headers: async () => ({ get: () => 'http://localhost:3000' }),
}))

vi.mock('next/navigation', () => ({ redirect: navigation.redirect }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

beforeEach(() => {
  const store = getE2EStore()
  store.sessions.clear()
  store.attempts.clear()
  serverCookieValues.clear()
  navigation.redirect.mockClear()
  createClient.mockReset()
})

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

function enableFixtureMode() {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('MORI_E2E_FIXTURES', '1')
}

function credentialsForm(email: string, password: string, next?: string) {
  const formData = new FormData()
  formData.set('email', email)
  formData.set('password', password)
  if (next) formData.set('next', next)
  return formData
}

async function invokeAuthAction(
  action: (formData: FormData) => Promise<AuthActionState>,
  formData: FormData,
) {
  return action(formData)
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
    enableFixtureMode()
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

  it.each([
    ['production', 'production', '1'],
    ['off mode', 'development', undefined],
  ])('fails closed in %s before creating an owner session', async (_, nodeEnv, fixtureFlag) => {
    vi.stubEnv('NODE_ENV', nodeEnv)
    vi.stubEnv('MORI_E2E_FIXTURES', fixtureFlag)
    const store = getE2EStore()
    store.sessions.clear()
    serverCookieValues.clear()

    const disabledOperations = [
      () => getE2ECurrentUser(),
      () => signInE2E('admin@mori.tw', 'mori123456'),
      () => signUpE2E('blocked@example.com', 'parent123'),
      () => signOutE2E(),
    ]
    for (const operation of disabledOperations) {
      await expect(operation()).rejects.toThrow('Fixture authentication is disabled')
    }
    expect(store.sessions.size).toBe(0)
    expect(serverCookieValues.size).toBe(0)
  })

  it('preserves the requested fixture pathname when authentication is required', async () => {
    enableFixtureMode()

    await expect(requireUser('/account/orders')).rejects.toBe(navigation.sentinel)

    expect(navigation.redirect).toHaveBeenCalledWith('/login?next=%2Faccount%2Forders')
  })

  it('routes fixture owner and customer sign-ins without constructing Supabase', async () => {
    enableFixtureMode()
    createClient.mockRejectedValue(new Error('Supabase must not be constructed in fixture mode'))

    await expect(invokeAuthAction(
      signInAction,
      credentialsForm('admin@mori.tw', 'mori123456'),
    )).rejects.toBe(navigation.sentinel)
    expect(navigation.redirect).toHaveBeenLastCalledWith('/admin')

    const email = `member-${crypto.randomUUID()}@example.com`
    await signUpE2E(email, 'parent123')
    navigation.redirect.mockClear()
    await expect(invokeAuthAction(
      signInAction,
      credentialsForm(email, 'parent123', '/account/orders'),
    )).rejects.toBe(navigation.sentinel)
    expect(navigation.redirect).toHaveBeenLastCalledWith('/account/orders')

    navigation.redirect.mockClear()
    await expect(invokeAuthAction(
      signInAction,
      credentialsForm(email, 'parent123'),
    )).rejects.toBe(navigation.sentinel)
    expect(navigation.redirect).toHaveBeenLastCalledWith('/account')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('returns fixture signup success and duplicate copy without verification wording', async () => {
    enableFixtureMode()
    const email = `member-${crypto.randomUUID()}@example.com`
    const formData = credentialsForm(email, 'parent123')

    await expect(invokeAuthAction(signUpAction, formData)).resolves.toEqual({
      ok: true,
      message: '註冊成功，現在可以使用相同帳密登入。',
    })
    await expect(invokeAuthAction(signUpAction, formData)).resolves.toEqual({
      ok: false,
      message: '這個 Email 已經註冊，請直接登入。',
    })
  })

  it('clears the fixture session before sign-out redirects home', async () => {
    enableFixtureMode()
    await signInE2E('admin@mori.tw', 'mori123456')

    await expect(signOutAction()).rejects.toBe(navigation.sentinel)

    expect(navigation.redirect).toHaveBeenCalledWith('/')
    await expect(getE2ECurrentUser()).resolves.toBeNull()
  })

  it('requires an owner fixture session for admin access', async () => {
    enableFixtureMode()

    await expect(requireAdmin()).rejects.toBe(navigation.sentinel)
    expect(navigation.redirect).toHaveBeenLastCalledWith('/login?next=%2Fadmin')

    const email = `member-${crypto.randomUUID()}@example.com`
    await signUpE2E(email, 'parent123')
    await signInE2E(email, 'parent123')
    navigation.redirect.mockClear()
    await expect(requireAdmin()).rejects.toBe(navigation.sentinel)
    expect(navigation.redirect).toHaveBeenLastCalledWith('/403')

    await signOutE2E()
    await signInE2E('admin@mori.tw', 'mori123456')
    await expect(requireAdmin()).resolves.toMatchObject({ id: 'admin', role: 'admin' })
  })

  it('attaches fixture checkout attempts to members while guests remain anonymous', async () => {
    enableFixtureMode()
    const store = getE2EStore()
    const input = {
      email: 'parent@example.com',
      recipientName: '王小美',
      phone: '0912345678',
      chain: 'seven_eleven' as const,
      storeId: '123456',
    }
    const cart = [{ variantId: '00000000-0000-4000-8000-000000000001', quantity: 1 }]

    const guestAttempt = await createPaymentAttempt(input, cart)
    expect(store.attempts.get(guestAttempt.attemptId)?.userId).toBeNull()

    const email = `member-${crypto.randomUUID()}@example.com`
    await signUpE2E(email, 'parent123')
    const member = await signInE2E(email, 'parent123')
    const memberAttempt = await createPaymentAttempt(input, cart)
    expect(store.attempts.get(memberAttempt.attemptId)?.userId).toBe(member?.id)
  })

  it('keeps production sign-in authoritative to Supabase', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MORI_E2E_FIXTURES', '1')
    const signInWithPassword = vi.fn().mockResolvedValue({ error: new Error('invalid login') })
    createClient.mockResolvedValue({ auth: { signInWithPassword } })

    await expect(invokeAuthAction(
      signInAction,
      credentialsForm('admin@mori.tw', 'mori123456'),
    )).resolves.toEqual({ ok: false, message: 'Email 或密碼不正確，請再試一次。' })
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@mori.tw',
      password: 'mori123456',
    })
    expect(getE2EStore().sessions.size).toBe(0)
    expect(serverCookieValues.size).toBe(0)
  })

  it('keeps production admin authorization authoritative to the profile role', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MORI_E2E_FIXTURES', '1')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-key')
    const liveUser = { id: 'live-user' }
    const getUser = vi.fn().mockResolvedValue({ data: { user: liveUser }, error: null })
    const profileQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
    }
    profileQuery.select.mockReturnValue(profileQuery)
    profileQuery.eq.mockReturnValue(profileQuery)
    const from = vi.fn().mockReturnValue(profileQuery)
    createClient
      .mockResolvedValueOnce({ auth: { getUser } })
      .mockResolvedValueOnce({ from })

    await expect(requireAdmin()).resolves.toBe(liveUser)
    expect(from).toHaveBeenCalledWith('profiles')
    expect(profileQuery.eq).toHaveBeenCalledWith('id', 'live-user')
    expect(serverCookieValues.size).toBe(0)
  })
})
