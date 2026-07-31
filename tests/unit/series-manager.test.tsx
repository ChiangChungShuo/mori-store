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

  it('adds a preset series to the selected category on click', () => {
    render(
      <SeriesManager
        categories={['上衣', '褲裝']}
        series={series}
        seriesPresets={['Mori flora 漫花系列', 'Mori lumi 拾光系列']}
        createSeries={action}
        moveSeries={action}
        deleteSeries={action}
        createPreset={action}
        deletePreset={action}
      />,
    )

    const chips = screen.getByLabelText('常用系列')
    // Already in 上衣, so it cannot be added twice.
    expect(within(chips).getByRole('button', { name: 'Mori flora 漫花系列（此分類已加入）' })).toBeDisabled()

    const addable = within(chips).getByRole('button', { name: '將 Mori lumi 拾光系列 加入 上衣' })
    expect(addable).toBeEnabled()
    fireEvent.click(addable)
    expect(action).toHaveBeenCalled()
  })

  it('re-targets the preset chips when the category changes', () => {
    render(
      <SeriesManager
        categories={['上衣', '褲裝']}
        series={series}
        seriesPresets={['Mori flora 漫花系列']}
        createSeries={action}
        moveSeries={action}
        deleteSeries={action}
        createPreset={action}
        deletePreset={action}
      />,
    )

    const chips = screen.getByLabelText('常用系列')
    expect(within(chips).getByRole('button', { name: /此分類已加入/ })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('選擇商品分類'), { target: { value: '褲裝' } })
    // 褲裝 does not have it yet, so the same chip becomes addable.
    expect(within(chips).getByRole('button', { name: '將 Mori flora 漫花系列 加入 褲裝' })).toBeEnabled()
  })

  it('offers removal from the reusable list separately from the category', () => {
    render(
      <SeriesManager
        categories={['上衣']}
        series={series}
        seriesPresets={['Mori lumi 拾光系列']}
        createSeries={action}
        moveSeries={action}
        deleteSeries={action}
        createPreset={action}
        deletePreset={action}
      />,
    )

    expect(screen.getByRole('button', { name: '從常用系列移除 Mori lumi 拾光系列' })).toBeEnabled()
  })

  it('hides the reusable list when no preset actions are supplied', () => {
    render(
      <SeriesManager
        categories={['上衣']}
        series={series}
        createSeries={action}
        moveSeries={action}
        deleteSeries={action}
      />,
    )

    expect(screen.queryByLabelText('常用系列')).not.toBeInTheDocument()
  })

  it('explains how to seed the list when it is empty', () => {
    render(
      <SeriesManager
        categories={['上衣']}
        series={series}
        seriesPresets={[]}
        createSeries={action}
        moveSeries={action}
        deleteSeries={action}
        createPreset={action}
        deletePreset={action}
      />,
    )

    expect(screen.getByText(/尚未建立常用系列/)).toBeInTheDocument()
  })
})
