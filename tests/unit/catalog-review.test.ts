import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('catalog review invariants', () => {
  it('refreshes cart variants through a focused server route and published product query', () => {
    const routePath = resolve(process.cwd(), 'src/app/api/cart/refresh/route.ts')
    expect(existsSync(routePath)).toBe(true)
    if (!existsSync(routePath)) return

    const route = readFileSync(routePath, 'utf8')
    const queries = readFileSync(
      resolve(process.cwd(), 'src/features/catalog/queries.ts'),
      'utf8',
    )

    expect(route).toMatch(/getPublishedCartVariants/)
    expect(queries).toMatch(/\.eq\(['"]products\.is_published['"], true\)/)
    expect(queries).toMatch(/\.eq\(['"]is_active['"], true\)/)
    expect(queries).toMatch(/\.eq\(['"]product_variants\.is_active['"], true\)/)
  })

  it('excludes inactive variants from checkout server pricing', () => {
    const checkout = readFileSync(
      resolve(process.cwd(), 'src/features/checkout/service.ts'),
      'utf8',
    )

    expect(checkout).toMatch(/\.eq\(['"]is_active['"], true\)/)
  })

  it('limits the homepage new arrivals section to isNew products', () => {
    const homepage = readFileSync(
      resolve(process.cwd(), 'src/app/(store)/page.tsx'),
      'utf8',
    )

    expect(homepage).toMatch(/products\.filter\(\(product\) => product\.isNew\)/)
  })
})
