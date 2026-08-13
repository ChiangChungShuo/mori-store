import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('checkout member contract', () => {
  it('requires a member before rendering checkout or accepting submission', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'src/app/(store)/checkout/page.tsx'),
      'utf8',
    )

    expect(page).toMatch(/requireUser\('\/checkout'\)/)
    expect(page).not.toContain('getCurrentUser()')
  })

  it('sends guests to login and returns them to checkout', () => {
    const cartPage = readFileSync(
      resolve(process.cwd(), 'src/features/cart/cart-page-client.tsx'),
      'utf8',
    )
    const cartDrawer = readFileSync(
      resolve(process.cwd(), 'src/features/cart/cart-drawer.tsx'),
      'utf8',
    )

    expect(cartPage).toContain("isSignedIn ? '/checkout' : '/login?next=%2Fcheckout'")
    expect(cartDrawer).toContain('isSignedIn')
    expect(cartDrawer).toContain("isSignedIn ? '/checkout' : '/login?next=%2Fcheckout'")
  })
})
