import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('homepage merchandising contract', () => {
  it('keeps one concise shopping path without repeated product rows', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/(store)/page.tsx'), 'utf8')

    expect(source).toContain('.slice(0, 8)')
    expect(source).toContain('storefront-shortcuts')
    expect(source).toContain('<strong>依系列瀏覽</strong>')
    expect(source).toContain('home-featured-series')
    expect(source).toContain('fulfillment-story')
    expect(source).not.toContain('home-keep-browsing')
    expect(source).not.toContain('id="popular"')
    expect(source).not.toContain('id="ages"')
    expect(source).not.toContain('brand-story')
  })
})
