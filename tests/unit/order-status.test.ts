import { describe, expect, it } from 'vitest'
import { canTransitionOrder } from '@/features/orders/status'

describe('canTransitionOrder', () => {
  it('allows the normal fulfillment path', () => {
    expect(canTransitionOrder('paid', 'preparing')).toBe(true)
    expect(canTransitionOrder('preparing', 'shipped')).toBe(true)
  })

  it('rejects moving a collected order backwards', () => {
    expect(canTransitionOrder('collected', 'preparing')).toBe(false)
  })
})
