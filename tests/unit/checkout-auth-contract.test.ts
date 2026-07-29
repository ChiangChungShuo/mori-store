import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('checkout authentication contract', () => {
  it('guards both checkout page rendering and order-attempt submission', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'src/app/(store)/checkout/page.tsx'),
      'utf8',
    )

    expect(page.match(/await requireUser\('\/checkout'\)/g)).toHaveLength(2)
  })

  it('sends signed-out cart actions through login before checkout', () => {
    const cartPage = readFileSync(
      resolve(process.cwd(), 'src/features/cart/cart-page-client.tsx'),
      'utf8',
    )
    const cartDrawer = readFileSync(
      resolve(process.cwd(), 'src/features/cart/cart-drawer.tsx'),
      'utf8',
    )

    expect(cartPage).toContain("isSignedIn ? '/checkout' : '/login?next=%2Fcheckout'")
    expect(cartDrawer).toContain("isSignedIn ? '/checkout' : '/login?next=%2Fcheckout'")
  })
})
