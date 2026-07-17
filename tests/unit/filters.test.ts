import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SiteHeader } from '@/components/site-header'
import { CartProvider } from '@/features/cart/cart-provider'
import { ProductCard } from '@/features/catalog/product-card'
import { ProductFilters } from '@/features/catalog/product-filters'
import { parseProductFilters } from '@/features/catalog/queries'
import { VariantPicker } from '@/features/catalog/variant-picker'

const product = {
  id: 'product-1',
  slug: 'mori-organic-cotton-tee',
  name: '有機棉小樹 T 恤',
  description: '柔軟透氣的日常有機棉 T 恤。',
  category: '上衣',
  ageBands: ['3-5', '6-9'] as const,
  material: '100% 有機棉',
  careInstructions: '建議冷水洗滌。',
  sizeGuide: '版型正常。',
  isNew: true,
  imageUrl: null,
  imageAlt: '有機棉小樹 T 恤',
  variants: [
    { id: 'sage-100', sku: 'SAGE-100', color: '鼠尾草綠', size: '100', price: 680, compareAtPrice: null, stock: 2 },
    { id: 'sage-120', sku: 'SAGE-120', color: '鼠尾草綠', size: '120', price: 780, compareAtPrice: null, stock: 0 },
    { id: 'pink-110', sku: 'PINK-110', color: '珊瑚粉', size: '110', price: 720, compareAtPrice: null, stock: 3 },
  ],
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('parseProductFilters', () => {
  it('keeps only the fixed 0-12 age bands and supported stock value', () => {
    expect(parseProductFilters({ age: '6-9', color: '鼠尾草綠', inStock: 'true' })).toEqual({
      age: '6-9',
      color: '鼠尾草綠',
      inStock: true,
    })
    expect(parseProductFilters({ age: '13-15', inStock: 'false' })).toEqual({})
  })

  it('uses the first value when a search parameter is repeated', () => {
    expect(parseProductFilters({ size: ['100', '120'], category: ['上衣', '下著'] })).toEqual({
      size: '100',
      category: '上衣',
    })
  })
})

describe('ProductFilters', () => {
  it('renders a GET form whose values come from the current URL filters', () => {
    render(createElement(ProductFilters, {
      filters: { age: '6-9', size: '120', inStock: true },
    }))

    expect(screen.getByRole('form', { name: '篩選商品' })).toHaveAttribute('method', 'get')
    expect(screen.getByLabelText('年齡')).toHaveValue('6-9')
    expect(screen.getByLabelText('尺寸')).toHaveValue('120')
    expect(screen.getByLabelText('只顯示有庫存')).toBeChecked()
  })
})

describe('store navigation', () => {
  it('keeps homepage section links valid from catalog routes', () => {
    render(createElement(SiteHeader))

    expect(screen.getByRole('link', { name: '新品' })).toHaveAttribute('href', '/#new')
    expect(screen.getByRole('link', { name: '依年齡' })).toHaveAttribute('href', '/#ages')
    expect(screen.getByRole('link', { name: '品牌故事' })).toHaveAttribute('href', '/#story')
  })
})

describe('ProductCard', () => {
  it('shows color count, size range and minimum variant price', () => {
    render(createElement(ProductCard, { product }))

    expect(screen.getByText('2 種顏色')).toBeInTheDocument()
    expect(screen.getByText('尺寸 100–120')).toBeInTheDocument()
    expect(screen.getByText('NT$680 起')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看 有機棉小樹 T 恤' })).toHaveAttribute(
      'href',
      '/products/mori-organic-cotton-tee',
    )
  })
})

describe('VariantPicker', () => {
  it('derives sizes from the selected color and disables unavailable variants', () => {
    render(createElement(CartProvider, null, createElement(VariantPicker, { product })))

    expect(screen.queryByRole('button', { name: '尺寸 110' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '尺寸 120（缺貨）' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '加入購物袋' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '顏色 珊瑚粉' }))
    expect(screen.getByRole('button', { name: '尺寸 110' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '尺寸 100' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '尺寸 110' }))
    expect(screen.getByRole('button', { name: '加入購物袋' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('庫存 3 件')
  })
})
