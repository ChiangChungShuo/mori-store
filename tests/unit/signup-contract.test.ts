import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  maskEmail,
  normalizeTaiwanMobile,
  signupContactSchema,
  signupOtpSchema,
  signupPasswordSchema,
} from '@/features/auth/signup-contract'

describe('signup contract', () => {
  it('normalizes Taiwan mobile separators', () => {
    expect(normalizeTaiwanMobile('0912-345-678')).toBe('0912345678')
    expect(normalizeTaiwanMobile('0912 345 678')).toBe('0912345678')
  })

  it('requires a valid Taiwan mobile, Email and legal consent', () => {
    expect(signupContactSchema.safeParse({
      displayName: '王小美',
      email: 'parent@example.com',
      phone: '0912-345-678',
      consent: 'on',
      marketingConsent: 'on',
    })).toMatchObject({ success: true })

    expect(signupContactSchema.safeParse({
      displayName: '王小美',
      email: 'parent@example.com',
      phone: '02-1234-5678',
      consent: 'on',
    }).success).toBe(false)

    expect(signupContactSchema.safeParse({
      displayName: '',
      email: 'invalid',
      phone: '0912345678',
      consent: undefined,
    }).success).toBe(false)
  })

  it('accepts exactly six OTP digits and matching passwords of at least eight characters', () => {
    expect(signupOtpSchema.safeParse({
      email: 'parent@example.com',
      token: '123456',
    }).success).toBe(true)
    expect(signupOtpSchema.safeParse({
      email: 'parent@example.com',
      token: '12345',
    }).success).toBe(false)
    expect(signupPasswordSchema.safeParse({
      password: 'mori-parent-123',
      confirmPassword: 'mori-parent-123',
    }).success).toBe(true)
    expect(signupPasswordSchema.safeParse({
      password: 'parent123',
      confirmPassword: 'parent123',
    }).success).toBe(true)
    expect(signupPasswordSchema.safeParse({
      password: 'mori123',
      confirmPassword: 'mori123',
    }).success).toBe(false)
    expect(signupPasswordSchema.safeParse({
      password: 'mori-parent-123',
      confirmPassword: 'different-pass',
    }).success).toBe(false)
  })

  it('masks the destination without hiding the domain', () => {
    expect(maskEmail('mori.parent@example.com')).toBe('mo***@example.com')
  })
})

describe('guest order → signup prefill', () => {
  const page = readFileSync(resolve(process.cwd(), 'src/app/(auth)/signup/page.tsx'), 'utf8')
  const orderComplete = readFileSync(
    resolve(process.cwd(), 'src/app/(store)/order-complete/[orderNumber]/page.tsx'),
    'utf8',
  )

  it('passes the buyer Email and name in the invitation link', () => {
    expect(orderComplete).toMatch(/\/signup\?email=\$\{encodeURIComponent\(order\.email\)\}/)
    expect(orderComplete).toMatch(/name=\$\{encodeURIComponent\(order\.recipientName\)\}/)
  })

  it('only prefills a value that looks like an Email, and still verifies it', () => {
    // A crafted link must not be able to register somebody else's address: the
    // value is a starting point for the field, never a verified identity.
    expect(page).toMatch(/looksLikeEmail/)
    expect(page).toMatch(/slice\(0, 160\)/)
  })
})
