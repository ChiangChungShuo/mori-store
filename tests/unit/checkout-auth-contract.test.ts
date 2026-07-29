import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('checkout guest contract', () => {
  it('does not gate checkout page rendering or order submission behind login', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'src/app/(store)/checkout/page.tsx'),
      'utf8',
    )

    expect(page).not.toMatch(/requireUser\('\/checkout'\)/)
    expect(page).toContain('getCurrentUser()')
  })

  it('sends shoppers straight to checkout from the cart (guests included)', () => {
    const cartPage = readFileSync(
      resolve(process.cwd(), 'src/features/cart/cart-page-client.tsx'),
      'utf8',
    )
    const cartDrawer = readFileSync(
      resolve(process.cwd(), 'src/features/cart/cart-drawer.tsx'),
      'utf8',
    )

    expect(cartPage).toContain('href="/checkout"')
    expect(cartDrawer).toContain('href="/checkout"')
  })
})
