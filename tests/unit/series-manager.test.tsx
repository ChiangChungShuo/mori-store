import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SeriesManager } from '@/features/admin/series-manager'
import type { ProductSeries } from '@/features/catalog/product-series'

const series: ProductSeries[] = [
  { id: '10000000-0000-4000-8000-000000000001', categoryName: '上衣', name: 'Mori flora 漫花系列', position: 0 },
  { id: '10000000-0000-4000-8000-000000000002', categoryName: '上衣', name: 'Mori forest 森林系列', position: 1 },
  { id: '10000000-0000-4000-8000-000000000003', categoryName: '褲裝', name: 'Mori daily 日常系列', position: 0 },
]

const action = vi.fn(async () => ({ ok: true, message: '完成' }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('series manager', () => {
  it('shows only series belonging to the selected category', () => {
    render(
      <SeriesManager
        categories={['上衣', '褲裝']}
        series={series}
        createSeries={action}
        moveSeries={action}
        deleteSeries={action}
      />,
    )

    const list = screen.getByRole('list', { name: '上衣系列' })
    expect(within(list).getByText('Mori flora 漫花系列')).toBeInTheDocument()
    expect(within(list).getByText('Mori forest 森林系列')).toBeInTheDocument()
    expect(screen.queryByText('Mori daily 日常系列')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('選擇商品分類'), { target: { value: '褲裝' } })
    expect(screen.getByRole('list', { name: '褲裝系列' })).toHaveTextContent('Mori daily 日常系列')
    expect(screen.queryByText('Mori flora 漫花系列')).not.toBeInTheDocument()
  })

  it('disables unavailable move controls and carries the selected category into create', () => {
    const { container } = render(
      <SeriesManager
        categories={['上衣', '褲裝']}
        series={series}
        createSeries={action}
        moveSeries={action}
        deleteSeries={action}
      />,
    )

    expect(screen.getByRole('button', { name: '上移 Mori flora 漫花系列' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '下移 Mori forest 森林系列' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '刪除系列 Mori flora 漫花系列' })).toBeEnabled()
    expect(container.querySelector('form.admin-series-create input[name="categoryName"]')).toHaveValue('上衣')
  })
})
