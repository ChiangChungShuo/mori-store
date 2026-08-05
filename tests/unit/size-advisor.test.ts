import { describe, expect, it } from 'vitest'
import { suggestSize } from '@/features/catalog/size-advisor'

const sizes = ['100', '110', '120']

describe('suggestSize', () => {
  it('matches the standard band when the shop sells that size', () => {
    expect(suggestSize(104, sizes)).toEqual({ size: '100', exact: true })
    expect(suggestSize(112, sizes)).toEqual({ size: '110', exact: true })
  })

  it('rounds up to the next size sold, because children grow into clothes', () => {
    // 90 band is not stocked here, so the advisor offers 100 rather than nothing.
    expect(suggestSize(88, sizes)).toEqual({ size: '100', exact: false })
  })

  it('falls back to the largest size sold when the child is taller than the range', () => {
    expect(suggestSize(140, sizes)).toEqual({ size: '120', exact: false })
  })

  it('returns nothing for implausible heights or an empty size list', () => {
    expect(suggestSize(20, sizes)).toBeNull()
    expect(suggestSize(200, sizes)).toBeNull()
    expect(suggestSize(Number.NaN, sizes)).toBeNull()
    expect(suggestSize(104, [])).toBeNull()
    expect(suggestSize(104, ['F'])).toBeNull()
  })
})
