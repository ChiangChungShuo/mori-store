import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('storefront home settings contract', () => {
  it('renders the home shipping message from the single storefront setting', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/app/(store)/page.tsx'), 'utf8')

    expect(page).toContain('getStorefrontSettings()')
    expect(page).toContain('settings.freeShippingThreshold')
    expect(page).not.toMatch(/滿 NT\$1,500 免運/)
  })
})
