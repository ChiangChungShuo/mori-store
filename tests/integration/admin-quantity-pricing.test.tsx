import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductForm } from '@/features/admin/product-form'
import type { ProductInput } from '@/lib/validation/product'

const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const variantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const product: ProductInput = {
  name: '雲朵包屁衣',
  slug: 'mori-cloud-romper',
  category: 'tops',
  seriesIds: [],
  ageBands: ['0-3'],
  description: '柔軟包屁衣',
  material: '100% 有機棉',
  careInstructions: '冷水洗滌',
  sizeGuide: '正常版型',
  isNew: false,
  quantityPrices: [],
  variants: [{
    id: variantId,
    updatedAt: '2026-07-17T10:00:00.000Z',
    sku: 'ROMPER-70',
    color: '雲朵米',
    size: '70',
    price: 580,
    cost: 260,
    stock: 5,
  }],
}

afterEach(cleanup)

describe('admin quantity pricing editor', () => {
  it('starts with no tiers and explains the unit price', () => {
    const view = render(createElement(ProductForm, { initialProduct: product, onSave: vi.fn() }))
    const form = within(view.container)

    expect(form.getByText(/尚未設定多件優惠/)).toBeInTheDocument()
    expect(form.getByText(/NT\$580/)).toBeInTheDocument()
  })

  it('adds a tier with a suggested price and previews the saving', () => {
    const view = render(createElement(ProductForm, { initialProduct: product, onSave: vi.fn() }))
    const form = within(view.container)

    fireEvent.click(form.getByRole('button', { name: /新增件數階梯/ }))

    // Defaults to 2 items at a rounded 10%-off price: 580 × 2 × 0.9 = 1044 → 1040.
    expect((form.getByLabelText('任選件數') as HTMLInputElement).value).toBe('2')
    expect((form.getByLabelText('組合價') as HTMLInputElement).value).toBe('1040')
    expect(form.getAllByText(/省 NT\$120/).length).toBeGreaterThan(0)
    expect(form.getByText(/買 2 件原價 NT\$1,160，優惠後 NT\$1,040/)).toBeInTheDocument()
  })

  it('suggests the next unused quantity for a second tier', () => {
    const view = render(createElement(ProductForm, { initialProduct: product, onSave: vi.fn() }))
    const form = within(view.container)

    fireEvent.click(form.getByRole('button', { name: /新增件數階梯/ }))
    fireEvent.click(form.getByRole('button', { name: /新增件數階梯/ }))

    const quantities = form.getAllByLabelText('任選件數') as HTMLInputElement[]
    expect(quantities.map((input) => input.value)).toEqual(['2', '3'])
  })

  it('removes a tier', () => {
    const view = render(createElement(ProductForm, { initialProduct: product, onSave: vi.fn() }))
    const form = within(view.container)

    fireEvent.click(form.getByRole('button', { name: /新增件數階梯/ }))
    fireEvent.click(form.getByRole('button', { name: /移除任選 2 件的優惠/ }))

    expect(form.getByText(/尚未設定多件優惠/)).toBeInTheDocument()
  })

  it('rejects a bundle price that is not cheaper than buying separately', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true, productId })
    const view = render(createElement(ProductForm, { initialProduct: product, onSave }))
    const form = within(view.container)

    fireEvent.click(form.getByRole('button', { name: /新增件數階梯/ }))
    fireEvent.change(form.getByLabelText('組合價'), { target: { value: '1160' } })
    fireEvent.click(form.getByRole('button', { name: '儲存商品' }))

    expect((await screen.findAllByText(/組合價需低於單買 2 件的 1160 元/)).length).toBeGreaterThan(0)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves valid tiers with the product', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true, productId })
    const view = render(createElement(ProductForm, { initialProduct: product, onSave }))
    const form = within(view.container)

    fireEvent.click(form.getByRole('button', { name: /新增件數階梯/ }))
    fireEvent.change(form.getByLabelText('組合價'), { target: { value: '1000' } })
    fireEvent.click(form.getByRole('button', { name: '儲存商品' }))
    fireEvent.click(await form.findByRole('button', { name: '確定儲存' }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({
      quantityPrices: [{ quantity: 2, bundlePrice: 1000 }],
    })
  })

  it('renders tiers already saved on the product', () => {
    const view = render(createElement(ProductForm, {
      initialProduct: { ...product, quantityPrices: [{ quantity: 3, bundlePrice: 1400 }] },
      onSave: vi.fn(),
    }))
    const form = within(view.container)

    expect((form.getByLabelText('任選件數') as HTMLInputElement).value).toBe('3')
    expect((form.getByLabelText('組合價') as HTMLInputElement).value).toBe('1400')
    expect(form.getAllByText(/省 NT\$340/).length).toBeGreaterThan(0)
  })
})
