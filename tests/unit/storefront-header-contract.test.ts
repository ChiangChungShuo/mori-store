import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('storefront header source contract', () => {
  it('wires auth and current categories into the header', () => {
    const layout = readFileSync(resolve(process.cwd(), 'src/app/(store)/layout.tsx'), 'utf8')

    expect(layout).toContain('getCurrentUser')
    expect(layout).toContain('listProductCategories')
    expect(layout).toContain('listProductSeries')
    expect(layout).toMatch(/<SiteHeader cart=\{<CartDrawer settings=\{settings\} isSignedIn=\{Boolean\(user\)\} \/>\} categories=\{categories\} freeShippingThreshold=\{settings\.freeShippingThreshold\} series=\{series\} isSignedIn=\{Boolean\(user\)\}/)
  })

  it('keeps the approved desktop controls and storefront breakpoint', () => {
    const header = readFileSync(resolve(process.cwd(), 'src/components/site-header.tsx'), 'utf8')
    const layout = readFileSync(resolve(process.cwd(), 'src/app/(store)/layout.tsx'), 'utf8')

    expect(header).toContain('WishlistHeaderLink')
    expect(header).toContain('nav-category-menu')
    expect(header).toContain('account-menu')
    expect(header).toContain('header-search')
    expect(header).toMatch(/<MobileMenu[^>]+breakpoint="36rem"/)
    expect(header).toContain('MobileHeaderSearch')
    expect(header).toContain('side="left"')
    expect(header).toContain('store-mobile-categories')
    expect(header).toContain('CategorySeriesMenu')
    expect(header).toMatch(/href=\{isSignedIn \? '\/account' : '\/login\?next=\/account'\}/)
    expect(header).not.toContain('store-mobile-search-heading')
    expect(header).not.toContain('store-mobile-account-heading')
    expect(layout).toMatch(/cart=\{<CartDrawer settings=\{settings\} isSignedIn=\{Boolean\(user\)\} \/>\}/)
  })
})
