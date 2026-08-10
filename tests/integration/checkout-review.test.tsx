import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CartProvider } from '@/features/cart/cart-provider'
import type { CartItem } from '@/features/cart/types'
import { CheckoutForm } from '@/features/checkout/checkout-form'
import { TestPayment } from '@/features/checkout/test-payment-panel'

const staleItem: CartItem = {
  variantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  productSlug: 'old-slug',
  name: '舊商品名稱',
  imageUrl: null,
  color: '舊顏色',
  size: '90',
  unitPrice: 1,
  quantity: 1,
  maxStock: 5,
}

const freshItem: CartItem = {
  ...staleItem,
  productSlug: 'mori-organic-cotton-tee',
  name: '有機棉小樹 T 恤',
  color: '鼠尾草綠',
  size: '100',
  unitPrice: 720,
  maxStock: 2,
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('checkout review UX', () => {
  it('renders the server-refreshed items, shipping and total instead of stale cart prices', async () => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([staleItem]))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      items: [freshItem],
      summary: { subtotal: 720, shipping: 60, total: 780 },
    })))

    render(createElement(
      CartProvider,
      null,
      createElement(CheckoutForm, {
        action: vi.fn().mockResolvedValue({ status: 'idle' }),
      }),
    ))

    expect(await screen.findByRole('heading', { name: '訂單摘要' })).toBeInTheDocument()
    const summary = within(screen.getByLabelText('訂單摘要'))
    expect(summary.getByText(/有機棉小樹 T 恤/)).toBeInTheDocument()
    expect(summary.getAllByText('NT$720')).toHaveLength(2)
    expect(summary.getByText('NT$60')).toBeInTheDocument()
    expect(summary.getByText('NT$780')).toBeInTheDocument()
    expect(summary.queryByText(/舊商品名稱/)).not.toBeInTheDocument()
  })

  it('enables payment only after contact details and a pickup store are complete', async () => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([staleItem]))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      items: [freshItem],
      summary: { subtotal: 720, shipping: 60, total: 780 },
    })))

    render(createElement(CartProvider, null, createElement(CheckoutForm, {
      action: vi.fn().mockResolvedValue({ status: 'idle' }),
    })))

    const submit = await screen.findByRole('button', { name: '請先完成訂單資料' })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'parent@example.com' } })
    fireEvent.change(screen.getByLabelText('收件人姓名'), { target: { value: '王小美' } })
    fireEvent.change(screen.getByLabelText('手機號碼'), { target: { value: '0912345678' } })
    fireEvent.change(screen.getByLabelText('取貨門市名稱'), { target: { value: '忠孝門市' } })
    fireEvent.change(screen.getByLabelText('門市店號'), { target: { value: '123456' } })

    await waitFor(() => expect(screen.getByRole('button', { name: '送出資料，確認訂單' })).toBeEnabled())
  })

  it('carries a cart coupon into checkout and updates the payable total', async () => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([staleItem]))
    window.sessionStorage.setItem('mori-checkout-coupon', 'HELLOMORI')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      items: [freshItem],
      summary: { subtotal: 720, shipping: 60, total: 780 },
    })))
    const couponAction = vi.fn().mockResolvedValue({
      ok: true,
      code: 'HELLOMORI',
      discount: 100,
      message: '已套用 HELLOMORI，折抵 NT$100。',
    })

    render(createElement(CartProvider, null, createElement(CheckoutForm, {
      action: vi.fn().mockResolvedValue({ status: 'idle' }),
      couponAction,
    })))

    await screen.findByRole('heading', { name: '訂單摘要' })
    await waitFor(() => expect(couponAction).toHaveBeenCalledWith('HELLOMORI', 720))
    expect(await screen.findByText('優惠碼 HELLOMORI')).toBeInTheDocument()
    expect(screen.getByText('NT$680')).toBeInTheDocument()
  })

  it('keeps the cart and shows update-cart guidance for a typed review result', async () => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([staleItem]))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      outcome: 'requires_review',
      reviewCode: 'stock_changed',
      message: '付款結果需人工確認，商品資料或庫存已變更。',
    })))

    render(createElement(
      CartProvider,
      null,
      createElement(TestPayment, { attemptId: staleItem.variantId }),
    ))
    fireEvent.click(screen.getByRole('button', { name: '模擬付款成功' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('付款結果需人工確認')
    expect(screen.getByRole('link', { name: '更新購物車' })).toHaveAttribute('href', '/cart')
    expect(JSON.parse(window.localStorage.getItem('mori-cart-v1') ?? '[]')).toHaveLength(1)
  })
})
