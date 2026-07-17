import { describe, expect, it } from 'vitest'
import { resolveProtectedDestination } from '@/lib/auth/protection'

describe('protected destinations', () => {
  it('sends guests to login', () => {
    expect(resolveProtectedDestination(null, '/account')).toBe('/login?next=%2Faccount')
  })

  it('rejects customers from admin', () => {
    expect(resolveProtectedDestination({ role: 'customer' }, '/admin')).toBe('/403')
  })

  it('keeps safe relative next paths', () => {
    expect(resolveProtectedDestination({ role: 'customer' }, '/account?tab=orders')).toBeNull()
  })

  it('rejects absolute next paths', () => {
    expect(resolveProtectedDestination(null, 'https://attacker.example')).toBe('/login')
  })

  it('rejects repeatedly encoded protocol-relative paths', () => {
    expect(resolveProtectedDestination(null, '/%252f%252fattacker.example')).toBe('/login')
  })

  it('rejects deeply encoded protocol-relative paths', () => {
    expect(resolveProtectedDestination(null, '/%252525252f%252525252fattacker.example')).toBe('/login')
  })
})
