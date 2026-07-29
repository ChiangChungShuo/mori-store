import { describe, expect, it } from 'vitest'
import { parseLoginIdentifier } from '@/features/auth/login-identifier'

describe('login identifier', () => {
  it('accepts and normalizes an Email address', () => {
    expect(parseLoginIdentifier(' Parent@Example.com ')).toEqual({
      type: 'email',
      value: 'parent@example.com',
    })
  })

  it('accepts a Taiwan mobile number with separators', () => {
    expect(parseLoginIdentifier('0912-345-678')).toEqual({
      type: 'phone',
      value: '0912345678',
    })
  })

  it('rejects identifiers that are neither Email nor mobile', () => {
    expect(parseLoginIdentifier('mori-member')).toBeNull()
  })
})
