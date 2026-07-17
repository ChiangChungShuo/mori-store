import { describe, expect, it } from 'vitest'
import { resolveCatalogConfiguration } from '@/features/catalog/queries'

describe('catalog Supabase configuration', () => {
  it('allows an empty fallback during development and production builds', () => {
    expect(resolveCatalogConfiguration({ NODE_ENV: 'development' })).toBe(false)
    expect(resolveCatalogConfiguration({
      NODE_ENV: 'production',
      NEXT_PHASE: 'phase-production-build',
    })).toBe(false)
  })

  it('throws a clear error when production runtime credentials are missing', () => {
    expect(() => resolveCatalogConfiguration({ NODE_ENV: 'production' })).toThrow(
      'MORI catalog configuration error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.',
    )
  })

  it('uses Supabase whenever both credentials exist', () => {
    expect(resolveCatalogConfiguration({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    })).toBe(true)
  })
})
