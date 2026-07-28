import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  completeSignup,
  requestSignupOtp,
  verifySignupOtp,
} from '@/features/auth/signup-actions'

const serverCookieValues = vi.hoisted(() => new Map<string, string>())
const navigation = vi.hoisted(() => {
  const sentinel = new Error('NEXT_REDIRECT_SENTINEL')
  return {
    sentinel,
    redirect: vi.fn(() => {
      throw sentinel
    }),
  }
})
const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
}))
const createClient = vi.hoisted(() => vi.fn(async () => ({ auth })))

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
vi.mock('next/navigation', () => ({ redirect: navigation.redirect }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

function contactForm() {
  const form = new FormData()
  form.set('email', 'Parent@Example.com')
  form.set('phone', '0912-345-678')
  form.set('consent', 'on')
  return form
}

function enableFixtureMode() {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('MORI_E2E_FIXTURES', '1')
  vi.stubEnv('VERCEL_ENV', '')
}

function enableProductionMode() {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('MORI_E2E_FIXTURES', '')
  vi.stubEnv('VERCEL_ENV', '')
}

beforeEach(() => {
  serverCookieValues.clear()
  navigation.redirect.mockClear()
  createClient.mockClear()
  auth.signInWithOtp.mockReset()
  auth.verifyOtp.mockReset()
  auth.getUser.mockReset()
  auth.updateUser.mockReset()
})

afterEach(() => vi.unstubAllEnvs())

describe('Email OTP signup actions', () => {
  it('requires Email, Taiwan mobile and consent before requesting OTP', async () => {
    const result = await requestSignupOtp(new FormData())

    expect(result.fieldErrors).toMatchObject({
      email: expect.any(Array),
      phone: expect.any(Array),
      consent: expect.any(Array),
    })
  })

  it('starts the fixture flow with normalized contact data', async () => {
    enableFixtureMode()

    await expect(requestSignupOtp(contactForm())).resolves.toMatchObject({
      ok: true,
      email: 'parent@example.com',
      phone: '0912345678',
      maskedEmail: 'pa***@example.com',
      resendAvailableAt: expect.any(Number),
    })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('rejects a wrong fixture OTP and accepts the fixed fixture OTP', async () => {
    enableFixtureMode()
    const email = `otp-${crypto.randomUUID()}@example.com`
    const contact = contactForm()
    contact.set('email', email)
    await requestSignupOtp(contact)

    const wrong = new FormData()
    wrong.set('email', email)
    wrong.set('token', '000000')
    await expect(verifySignupOtp(wrong)).resolves.toMatchObject({ ok: false })

    wrong.set('token', '123456')
    await expect(verifySignupOtp(wrong)).resolves.toEqual({ ok: true, verified: true })
  })

  it('completes a verified fixture signup and preserves a safe next path', async () => {
    enableFixtureMode()
    const email = `member-${crypto.randomUUID()}@example.com`
    const contact = contactForm()
    contact.set('email', email)
    await requestSignupOtp(contact)
    const otp = new FormData()
    otp.set('email', email)
    otp.set('token', '123456')
    await verifySignupOtp(otp)

    const password = new FormData()
    password.set('email', email)
    password.set('password', 'parent123')
    password.set('next', '/account/orders')

    await expect(completeSignup(password)).rejects.toBe(navigation.sentinel)
    expect(navigation.redirect).toHaveBeenCalledWith('/account/orders')
  })

  it('uses Supabase OTP and never returns raw provider errors', async () => {
    enableProductionMode()
    auth.signInWithOtp.mockResolvedValueOnce({ error: null })

    const success = await requestSignupOtp(contactForm())
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'parent@example.com',
      options: {
        shouldCreateUser: true,
        data: {
          phone: '0912345678',
          terms_accepted_at: expect.any(String),
        },
      },
    })
    expect(success.ok).toBe(true)

    auth.signInWithOtp.mockResolvedValueOnce({ error: new Error('provider-secret-detail') })
    await expect(requestSignupOtp(contactForm())).resolves.toEqual({
      ok: false,
      message: '目前無法寄出驗證碼，請稍後再試。',
    })
  })

  it('verifies through Supabase and sets the password for the authenticated user', async () => {
    enableProductionMode()
    auth.verifyOtp.mockResolvedValueOnce({ error: null })
    const otp = new FormData()
    otp.set('email', 'parent@example.com')
    otp.set('token', '123456')
    await expect(verifySignupOtp(otp)).resolves.toEqual({ ok: true, verified: true })
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'parent@example.com', token: '123456', type: 'email',
    })

    auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'member-id', email: 'parent@example.com' } },
      error: null,
    })
    auth.updateUser.mockResolvedValueOnce({ error: null })
    const password = new FormData()
    password.set('email', 'parent@example.com')
    password.set('password', 'parent123')

    await expect(completeSignup(password)).rejects.toBe(navigation.sentinel)
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'parent123' })
    expect(navigation.redirect).toHaveBeenCalledWith('/account')
  })
})
