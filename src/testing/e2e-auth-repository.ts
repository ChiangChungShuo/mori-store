import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { isE2EMode } from '@/testing/e2e-mode'
import type { E2EStoreState, E2EUser } from '@/testing/e2e-store'

export type AuthenticatedUser = Pick<E2EUser, 'id' | 'email' | 'role'>

export type CookieAdapter = {
  get(name: string): { value: string } | undefined
  set(name: string, value: string, options: {
    httpOnly: boolean
    maxAge: number
    path: '/'
    sameSite: 'lax'
    secure: boolean
  }): void
  delete(name: string): void
}

export const E2E_SESSION_COOKIE = 'mori-demo-session'

function normalizedEmail(email: string) {
  return email.trim().toLowerCase()
}

function passwordHash(password: string, salt: string) {
  return scryptSync(password, salt, 32)
}

function publicUser(user: E2EUser): AuthenticatedUser {
  return { id: user.id, email: user.email, role: user.role }
}

export function createE2EAuthRepository(store: E2EStoreState, cookieStore: CookieAdapter) {
  return {
    async requestSignupOtp(email: string, phone: string, termsAcceptedAt: string) {
      const canonicalEmail = normalizedEmail(email)
      if ([...store.users.values()].some((user) => user.email === canonicalEmail)) {
        return 'duplicate' as const
      }

      store.pendingSignups.set(canonicalEmail, {
        email: canonicalEmail,
        phone,
        termsAcceptedAt,
        code: '123456',
        requestedAt: new Date().toISOString(),
        verifiedAt: null,
      })
      return 'sent' as const
    },

    async verifySignupOtp(email: string, token: string) {
      const pending = store.pendingSignups.get(normalizedEmail(email))
      if (!pending) return 'invalid' as const
      if (Date.now() - new Date(pending.requestedAt).getTime() > 10 * 60_000) {
        return 'expired' as const
      }
      if (token !== pending.code) return 'invalid' as const

      pending.verifiedAt = new Date().toISOString()
      return 'verified' as const
    },

    async completeSignup(email: string, password: string) {
      const canonicalEmail = normalizedEmail(email)
      const pending = store.pendingSignups.get(canonicalEmail)
      if (!pending?.verifiedAt) return null
      if ([...store.users.values()].some((user) => user.email === canonicalEmail)) return null

      const salt = randomBytes(16).toString('hex')
      const user: E2EUser = {
        id: randomUUID(),
        email: canonicalEmail,
        role: 'customer',
        phone: pending.phone,
        termsAcceptedAt: pending.termsAcceptedAt,
        passwordSalt: salt,
        passwordHash: passwordHash(password, salt).toString('hex'),
      }
      store.users.set(user.id, user)
      store.pendingSignups.delete(canonicalEmail)

      const sessionId = randomUUID()
      store.sessions.set(sessionId, { userId: user.id, createdAt: new Date().toISOString() })
      cookieStore.set(E2E_SESSION_COOKIE, sessionId, {
        httpOnly: true,
        maxAge: 60 * 60 * 8,
        path: '/',
        sameSite: 'lax',
        secure: false,
      })
      return publicUser(user)
    },

    async signUp(email: string, password: string) {
      const canonicalEmail = normalizedEmail(email)
      if ([...store.users.values()].some((user) => user.email === canonicalEmail)) {
        return 'duplicate' as const
      }

      const salt = randomBytes(16).toString('hex')
      const user: E2EUser = {
        id: randomUUID(),
        email: canonicalEmail,
        role: 'customer',
        phone: null,
        termsAcceptedAt: null,
        passwordSalt: salt,
        passwordHash: passwordHash(password, salt).toString('hex'),
      }
      store.users.set(user.id, user)
      return 'created' as const
    },

    async signIn(email: string, password: string) {
      const user = [...store.users.values()].find(
        (candidate) => candidate.email === normalizedEmail(email),
      )
      if (!user) return null

      const actual = passwordHash(password, user.passwordSalt)
      const expected = Buffer.from(user.passwordHash, 'hex')
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null

      const sessionId = randomUUID()
      store.sessions.set(sessionId, { userId: user.id, createdAt: new Date().toISOString() })
      cookieStore.set(E2E_SESSION_COOKIE, sessionId, {
        httpOnly: true,
        maxAge: 60 * 60 * 8,
        path: '/',
        sameSite: 'lax',
        secure: false,
      })
      return publicUser(user)
    },

    async currentUser() {
      const sessionId = cookieStore.get(E2E_SESSION_COOKIE)?.value
      const session = sessionId ? store.sessions.get(sessionId) : undefined
      const user = session ? store.users.get(session.userId) : undefined
      return user ? publicUser(user) : null
    },

    async signOut() {
      const sessionId = cookieStore.get(E2E_SESSION_COOKIE)?.value
      if (sessionId) store.sessions.delete(sessionId)
      cookieStore.delete(E2E_SESSION_COOKIE)
    },
  }
}

async function createServerE2EAuthRepository() {
  if (!isE2EMode()) throw new Error('Fixture authentication is disabled')

  const [{ cookies }, { getE2EStore }] = await Promise.all([
    import('next/headers'),
    import('@/testing/e2e-store'),
  ])
  const cookieStore = await cookies()
  return createE2EAuthRepository(getE2EStore(), {
    get(name) {
      return cookieStore.get(name)
    },
    set(name, value, options) {
      cookieStore.set(name, value, options)
    },
    delete(name) {
      cookieStore.delete(name)
    },
  })
}

export async function getE2ECurrentUser(): Promise<AuthenticatedUser | null> {
  return (await createServerE2EAuthRepository()).currentUser()
}

export async function signInE2E(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  return (await createServerE2EAuthRepository()).signIn(email, password)
}

export async function signUpE2E(
  email: string,
  password: string,
): Promise<'created' | 'duplicate'> {
  return (await createServerE2EAuthRepository()).signUp(email, password)
}

export async function requestSignupOtpE2E(
  email: string,
  phone: string,
  termsAcceptedAt: string,
): Promise<'sent' | 'duplicate'> {
  return (await createServerE2EAuthRepository()).requestSignupOtp(email, phone, termsAcceptedAt)
}

export async function verifySignupOtpE2E(
  email: string,
  token: string,
): Promise<'verified' | 'invalid' | 'expired'> {
  return (await createServerE2EAuthRepository()).verifySignupOtp(email, token)
}

export async function completeSignupE2E(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  return (await createServerE2EAuthRepository()).completeSignup(email, password)
}

export async function signOutE2E(): Promise<void> {
  await (await createServerE2EAuthRepository()).signOut()
}
