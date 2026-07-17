import { describe, expect, it } from 'vitest'
import { formatTwd } from '@/lib/money'

describe('formatTwd', () => {
  it('formats integer Taiwan dollars without decimals', () => {
    expect(formatTwd(1680)).toBe('NT$1,680')
  })
})
