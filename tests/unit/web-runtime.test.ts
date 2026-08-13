import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { shouldBypassSessionRefresh } from '@/lib/supabase/proxy'

describe('Next.js web runtime contracts', () => {
  it('registers the Next 16 proxy from src with the existing matcher', () => {
    const rootProxy = resolve(process.cwd(), 'proxy.ts')
    const sourceProxy = resolve(process.cwd(), 'src/proxy.ts')

    expect(existsSync(rootProxy)).toBe(false)
    expect(existsSync(sourceProxy)).toBe(true)

    const proxy = readFileSync(sourceProxy, 'utf8')
    expect(proxy).toMatch(/export async function proxy/)
    expect(proxy).toMatch(/updateSession\(request\)/)
    expect(proxy).toContain("/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)")
  })

  it('bypasses Supabase only for credential-free local or preview fixture runs', () => {
    const helper = readFileSync(
      resolve(process.cwd(), 'src/lib/supabase/proxy.ts'),
      'utf8',
    )
    const fixtureMode = readFileSync(
      resolve(process.cwd(), 'src/testing/e2e-mode.ts'),
      'utf8',
    )

    expect(helper).toMatch(/MORI_E2E_FIXTURES/)
    expect(fixtureMode).toMatch(/NODE_ENV\s*!==\s*['"]production['"]/) 
    expect(fixtureMode).toMatch(/VERCEL_ENV\s*===\s*['"]preview['"]/) 
    expect(helper).toMatch(/NEXT_PUBLIC_SUPABASE_URL/)
    expect(helper).toMatch(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
    expect(helper).toMatch(/NextResponse\.next/)

    expect(shouldBypassSessionRefresh({
      NODE_ENV: 'development',
      MORI_E2E_FIXTURES: '1',
    })).toBe(true)
    expect(shouldBypassSessionRefresh({
      NODE_ENV: 'production',
      MORI_E2E_FIXTURES: '1',
    })).toBe(false)
    expect(shouldBypassSessionRefresh({
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
    })).toBe(true)
    expect(shouldBypassSessionRefresh({
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
    })).toBe(false)
    expect(shouldBypassSessionRefresh({ NODE_ENV: 'development' })).toBe(false)
    expect(shouldBypassSessionRefresh({
      NODE_ENV: 'development',
      MORI_E2E_FIXTURES: '1',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    })).toBe(false)
  })

  it('allows the validated 5 MB image plus multipart overhead', () => {
    const config = readFileSync(resolve(process.cwd(), 'next.config.ts'), 'utf8')

    expect(config).toMatch(/serverActions/)
    expect(config).toMatch(/bodySizeLimit:\s*['"]6mb['"]/)
  })

  it('provides the permission-denied destination used by requireAdmin', () => {
    const forbiddenPage = resolve(process.cwd(), 'src/app/403/page.tsx')

    expect(existsSync(forbiddenPage)).toBe(true)
    expect(readFileSync(forbiddenPage, 'utf8')).toMatch(/無權限/)
  })

  it('keeps checkout protected by the member sign-in flow', () => {
    const acceptance = readFileSync(
      resolve(process.cwd(), 'tests/e2e/guest-checkout.spec.ts'),
      'utf8',
    )

    expect(acceptance).toMatch(/page\.goto\(['"]\/checkout['"]\)/)
    expect(acceptance).toMatch(/\/login\\\?next=%2Fcheckout/)
    expect(acceptance).toMatch(/歡迎回到 MORIMUR BABY/)
  })

  it('renders checkout and payment summaries from server-owned data', () => {
    const refreshRoute = readFileSync(
      resolve(process.cwd(), 'src/app/api/cart/refresh/route.ts'),
      'utf8',
    )
    const checkoutPage = readFileSync(
      resolve(process.cwd(), 'src/app/(store)/checkout/page.tsx'),
      'utf8',
    )
    const paymentPage = readFileSync(
      resolve(process.cwd(), 'src/app/(store)/checkout/payment/[attemptId]/page.tsx'),
      'utf8',
    )

    expect(refreshRoute).toMatch(/summary/)
    expect(checkoutPage).toMatch(/toCheckoutActionState/)
    expect(paymentPage).toMatch(/getAuthorizedPaymentAttempt/)
    expect(paymentPage).toMatch(/payment\.items\.map/)
    expect(paymentPage).toMatch(/payment\.shippingFee/)
    expect(paymentPage).toMatch(/payment\.total/)
  })
})
