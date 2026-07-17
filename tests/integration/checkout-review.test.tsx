import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
    expect(screen.getByRole('link', { name: '更新購物袋' })).toHaveAttribute('href', '/cart')
    expect(JSON.parse(window.localStorage.getItem('mori-cart-v1') ?? '[]')).toHaveLength(1)
  })
})
