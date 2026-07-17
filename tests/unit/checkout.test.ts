import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CheckoutForm } from '@/features/checkout/checkout-form'
import { TEST_STORES } from '@/features/checkout/store-picker'
import { CartProvider } from '@/features/cart/cart-provider'
import { checkoutSchema } from '@/lib/validation/checkout'

describe('checkoutSchema', () => {
  it('accepts a Taiwan mobile and supported store', () => {
    const result = checkoutSchema.safeParse({
      email: 'parent@example.com',
      recipientName: '王小美',
      phone: '0912345678',
      chain: 'seven_eleven',
      storeId: '123456',
      storeName: '台北門市',
    })

    expect(result.success).toBe(true)
  })

  it('rejects unsupported stores and invalid Taiwan mobiles', () => {
    expect(checkoutSchema.safeParse({ chain: 'hilife' }).success).toBe(false)
    expect(checkoutSchema.safeParse({
      email: 'parent@example.com',
      recipientName: '王小美',
      phone: '0212345678',
      chain: 'family_mart',
      storeId: '12345',
      storeName: '台北門市',
    }).success).toBe(false)
  })
})

describe('test store picker', () => {
  it('provides at least two stores for each supported chain', () => {
    expect(TEST_STORES.filter((store) => store.chain === 'seven_eleven').length)
      .toBeGreaterThanOrEqual(2)
    expect(TEST_STORES.filter((store) => store.chain === 'family_mart').length)
      .toBeGreaterThanOrEqual(2)
    expect(TEST_STORES.every((store) => (
      store.storeId.length > 0
      && store.storeName.length > 0
      && store.address.length > 0
    ))).toBe(true)
  })

  it('requires customer and selected store fields', () => {
    render(createElement(
      CartProvider,
      null,
      createElement(CheckoutForm, { action: vi.fn() }),
    ))

    expect(screen.getByLabelText('Email')).toBeRequired()
    expect(screen.getByLabelText('收件人姓名')).toBeRequired()
    expect(screen.getByLabelText('手機號碼')).toBeRequired()
    expect(screen.getByLabelText('超商通路')).toBeRequired()
    expect(screen.getByLabelText('取貨門市')).toBeRequired()
  })
})
