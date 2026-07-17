import { describe, expect, it } from 'vitest'
import {
  CheckoutAttemptError,
  toCheckoutActionState,
} from '@/features/checkout/types'

describe('checkout action recovery', () => {
  it.each(['catalog_changed', 'stock_changed'] as const)(
    'turns %s into update-cart guidance instead of an exception page',
    (code) => {
      expect(toCheckoutActionState(new CheckoutAttemptError(code))).toEqual({
        status: 'error',
        message: '商品資料或庫存已變更，請更新購物袋後再試一次。',
        refreshCart: true,
      })
    },
  )

  it('keeps unexpected failures recoverable without exposing internals', () => {
    expect(toCheckoutActionState(new Error('database password leaked'))).toEqual({
      status: 'error',
      message: '目前無法建立付款交易，請稍後再試。',
      refreshCart: false,
    })
  })
})
