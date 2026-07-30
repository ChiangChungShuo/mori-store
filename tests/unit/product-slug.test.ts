import { describe, expect, it } from 'vitest'
import { generateProductSlug, slugifyProductName } from '@/lib/validation/product'

describe('slugifyProductName', () => {
  it('lowercases latin names and joins words with hyphens', () => {
    expect(slugifyProductName('Summer Organic Tee')).toBe('summer-organic-tee')
  })

  it('strips punctuation and collapses separators', () => {
    expect(slugifyProductName('  Mori — Tree / Tee!! ')).toBe('mori-tree-tee')
  })

  it('returns an empty string for all non-latin (e.g. Chinese) names', () => {
    expect(slugifyProductName('有機棉小樹上衣')).toBe('')
  })
})

describe('generateProductSlug', () => {
  it('appends a short token from the unique id to a latin base', () => {
    expect(generateProductSlug('Summer Tee', 'abcdef12-3456-7890-abcd-ef1234567890'))
      .toBe('summer-tee-abcdef')
  })

  it('falls back to a mori- prefix when the name has no latin characters', () => {
    expect(generateProductSlug('有機棉小樹上衣', 'abcdef12-3456'))
      .toBe('mori-abcdef')
  })

  it('always produces a non-empty slug', () => {
    expect(generateProductSlug('', '').length).toBeGreaterThan(0)
  })
})
