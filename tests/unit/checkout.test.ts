import { createElement, type ComponentType } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CheckoutForm } from '@/features/checkout/checkout-form'
import { StorePicker } from '@/features/checkout/store-picker'
import { CartProvider } from '@/features/cart/cart-provider'
import { checkoutSchema } from '@/lib/validation/checkout'
import { CheckoutProgress } from '@/features/checkout/checkout-progress'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

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

describe('CheckoutProgress', () => {
  it('marks the current and completed checkout steps', () => {
    render(createElement(CheckoutProgress, { current: 2 }))

    expect(screen.getByText('購物車').closest('li')).toHaveAttribute('data-state', 'complete')
    expect(screen.getByText('填寫資料').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('訂單確認').closest('li')).toHaveAttribute('data-state', 'upcoming')
  })
})

describe('store picker', () => {
  it('uses 7-ELEVEN map settings on mobile', () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined)
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone) Mobile')

    render(createElement(StorePicker, {
      chain: 'seven_eleven',
      storeName: '',
      storeId: '',
      onChainChange: vi.fn(),
      onStoreNameChange: vi.fn(),
      onStoreIdChange: vi.fn(),
    }))

    fireEvent.click(screen.getByRole('button', { name: '開啟 7-ELEVEN 門市地圖' }))

    const mapForm = document.body.querySelector<HTMLFormElement>('form[action="https://logistics-stage.ecpay.com.tw/Express/map"]')
    expect(mapForm).not.toBeNull()
    expect(new FormData(mapForm ?? undefined).get('LogisticsSubType')).toBe('UNIMARTC2C')
    expect(new FormData(mapForm ?? undefined).get('Device')).toBe('1')
    expect(submit).toHaveBeenCalledOnce()
    mapForm?.remove()
  })

  it('lets shoppers enter their own pickup store name and number', () => {
    const onStoreNameChange = vi.fn()
    const onStoreIdChange = vi.fn()

    render(createElement(StorePicker, {
      chain: 'seven_eleven',
      storeName: '',
      storeId: '',
      onChainChange: vi.fn(),
      onStoreNameChange,
      onStoreIdChange,
    }))

    fireEvent.change(screen.getByLabelText('取貨門市名稱'), { target: { value: '忠孝門市' } })
    expect(onStoreNameChange).toHaveBeenCalledWith('忠孝門市')

    fireEvent.change(screen.getByLabelText('門市店號'), { target: { value: '123456' } })
    expect(onStoreIdChange).toHaveBeenCalledWith('123456')
  })

  it('requires customer and pickup store fields', () => {
    render(createElement(
      CartProvider,
      null,
      createElement(CheckoutForm, { action: vi.fn() }),
    ))

    expect(screen.getByLabelText('Email')).toBeRequired()
    expect(screen.getByLabelText('收件人姓名')).toBeRequired()
    expect(screen.getByLabelText('手機號碼')).toBeRequired()
    expect(screen.getByRole('radio', { name: '7-ELEVEN' })).toBeRequired()
    expect(screen.queryByRole('radio', { name: '全家' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('取貨門市名稱')).toBeRequired()
    expect(screen.getByLabelText('門市店號')).toBeRequired()
  })

  it('keeps member contact details but clears a previous FamilyMart store', async () => {
    const CheckoutWithDefaults = CheckoutForm as ComponentType<Record<string, unknown>>
    render(createElement(
      CartProvider,
      null,
      createElement(CheckoutWithDefaults, {
        action: vi.fn(),
        initialValues: {
          email: 'parent@example.com',
          recipientName: '王小美',
          phone: '0912345678',
          chain: 'family_mart',
          storeName: '全家大安店',
          storeId: 'F00789',
        },
      }),
    ))

    expect(await screen.findByLabelText('Email')).toHaveValue('parent@example.com')
    expect(screen.getByLabelText('收件人姓名')).toHaveValue('王小美')
    expect(screen.getByLabelText('手機號碼')).toHaveValue('0912345678')
    expect(screen.getByRole('radio', { name: '7-ELEVEN' })).toBeChecked()
    expect(screen.getByLabelText('取貨門市名稱')).toHaveValue('')
    expect(screen.getByLabelText('門市店號')).toHaveValue('')
  })

  it('only offers 7-ELEVEN for new orders', () => {
    const CheckoutWithDefaults = CheckoutForm as ComponentType<Record<string, unknown>>
    render(createElement(
      CartProvider,
      null,
      createElement(CheckoutWithDefaults, {
        action: vi.fn(),
        initialValues: {
          email: 'parent@example.com',
          recipientName: '王小美',
          phone: '0912345678',
          chain: 'seven_eleven',
          storeName: '台北門市',
          storeId: '123456',
        },
      }),
    ))

    expect(screen.getByRole('radio', { name: '7-ELEVEN' })).toBeChecked()
    expect(screen.queryByRole('radio', { name: '全家' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('取貨門市名稱')).toHaveValue('台北門市')
    expect(screen.getByLabelText('門市店號')).toHaveValue('123456')
  })

  it('connects checkout validation errors to their fields', () => {
    const { container } = render(createElement(
      CartProvider,
      null,
      createElement(CheckoutForm, { action: vi.fn() }),
    ))
    const checkout = within(container)

    for (const [label, errorId] of [
      ['Email', 'checkout-email-error'],
      ['收件人姓名', 'checkout-recipient-name-error'],
      ['手機號碼', 'checkout-phone-error'],
      ['取貨門市名稱', 'checkout-store-name-error'],
      ['門市店號', 'checkout-store-error'],
    ]) {
      const field = checkout.getByLabelText(label)
      fireEvent.invalid(field)

      const error = container.querySelector(`#${errorId}`)
      expect(error).toHaveAttribute('role', 'alert')
      expect(field).toHaveAttribute('aria-describedby', errorId)
      expect(field).toHaveAccessibleName(label)
    }

    const chain = checkout.getByRole('radio', { name: '7-ELEVEN' })
    fireEvent.invalid(chain)
    expect(container.querySelector('#checkout-chain-error')).toHaveAttribute('role', 'alert')
    expect(chain).toHaveAttribute('aria-describedby', 'checkout-chain-error')
  })
})
