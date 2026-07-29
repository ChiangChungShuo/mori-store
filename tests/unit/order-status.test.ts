import { describe, expect, it } from 'vitest'
import { canTransitionOrder, getOrderJourney } from '@/features/orders/status'

describe('canTransitionOrder', () => {
  it('allows the normal fulfillment path', () => {
    expect(canTransitionOrder('paid', 'preparing')).toBe(true)
    expect(canTransitionOrder('preparing', 'shipped')).toBe(true)
  })

  it('rejects moving a collected order backwards', () => {
    expect(canTransitionOrder('collected', 'preparing')).toBe(false)
  })

  it('describes customer progress and an estimated store arrival', () => {
    expect(getOrderJourney('preparing', '2026-07-20T02:00:00.000Z')).toEqual(expect.objectContaining({
      label: '備貨中',
      activeStep: 2,
      estimatedArrival: '7 月 24 日前送達門市',
    }))
    expect(getOrderJourney('collected', '2026-07-20T02:00:00.000Z').estimatedArrival)
      .toBe('已完成取貨')
    expect(getOrderJourney('cancelled', '2026-07-20T02:00:00.000Z').activeStep).toBe(-1)
  })
})
