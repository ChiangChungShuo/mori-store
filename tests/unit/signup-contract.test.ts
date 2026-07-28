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
      email: 'parent@example.com',
      phone: '0912-345-678',
      consent: 'on',
    })).toMatchObject({ success: true })

    expect(signupContactSchema.safeParse({
      email: 'parent@example.com',
      phone: '02-1234-5678',
      consent: 'on',
    }).success).toBe(false)

    expect(signupContactSchema.safeParse({
      email: 'invalid',
      phone: '0912345678',
      consent: undefined,
    }).success).toBe(false)
  })

  it('accepts exactly six OTP digits and an eight-character password', () => {
    expect(signupOtpSchema.safeParse({
      email: 'parent@example.com',
      token: '123456',
    }).success).toBe(true)
    expect(signupOtpSchema.safeParse({
      email: 'parent@example.com',
      token: '12345',
    }).success).toBe(false)
    expect(signupPasswordSchema.safeParse({ password: 'parent12' }).success).toBe(true)
    expect(signupPasswordSchema.safeParse({ password: 'short' }).success).toBe(false)
  })

  it('masks the destination without hiding the domain', () => {
    expect(maskEmail('mori.parent@example.com')).toBe('mo***@example.com')
  })
})
