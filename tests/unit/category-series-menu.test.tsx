import { createElement } from 'react'
import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CategorySeriesMenu } from '@/components/category-series-menu'

const categories = ['上衣', '褲裝']
const series = [
  { id: '10000000-0000-4000-8000-000000000001', categoryName: '上衣', name: 'Mori flora 漫花系列', position: 0 },
  { id: '10000000-0000-4000-8000-000000000002', categoryName: '上衣', name: 'Mori forest 森林系列', position: 1 },
  { id: '10000000-0000-4000-8000-000000000003', categoryName: '褲裝', name: 'Mori daily 日常系列', position: 0 },
]

afterEach(cleanup)

describe('CategorySeriesMenu', () => {
  it('renders category and series as a desktop two-column menu', () => {
    const { container } = render(createElement(CategorySeriesMenu, { categories, series, variant: 'desktop' }))
    const menu = container.querySelector<HTMLElement>('.desktop-category-series-menu')!

    expect(menu).toHaveAttribute('aria-label', '商品分類與系列')
    expect(within(menu).getByText('SHOP BY CATEGORY')).toBeInTheDocument()
    expect(within(menu).getByText('依分類挑選')).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: '所有商品' })).toHaveAttribute('href', '/products')
    expect(within(menu).getByRole('link', { name: /上衣.*2 個系列/ })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /褲裝.*1 個系列/ })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: '全部上衣' })).toHaveAttribute('href', '/products?category=%E4%B8%8A%E8%A1%A3')
    expect(within(menu).getByRole('link', { name: 'Mori Flora' })).toHaveAttribute('href', '/products?category=%E4%B8%8A%E8%A1%A3&series=Mori%20flora%20%E6%BC%AB%E8%8A%B1%E7%B3%BB%E5%88%97')
  })

  it('renders a nested category accordion for the mobile drawer', () => {
    const { container } = render(createElement(CategorySeriesMenu, { categories, series, variant: 'mobile' }))
    const menu = container.querySelector<HTMLElement>('.mobile-category-series-menu')!

    expect(menu.querySelectorAll('details')).toHaveLength(2)
    expect(within(menu).getByText('01')).toBeInTheDocument()
    expect(within(menu).getByText('02')).toBeInTheDocument()
    expect(within(menu).getByText('上衣')).toBeInTheDocument()
    expect(within(menu).getByText('2 個系列')).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: '全部上衣' })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: 'Mori forest 森林系列' })).toBeInTheDocument()
  })
})
