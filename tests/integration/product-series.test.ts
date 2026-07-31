import { describe, expect, it } from 'vitest'
import {
  createProductSeriesActions,
  type ProductSeries,
  type ProductSeriesRepository,
} from '@/features/catalog/product-series'

class MemoryProductSeriesRepository implements ProductSeriesRepository {
  series: ProductSeries[] = []
  used = new Set<string>()

  async list(categoryName?: string) {
    return this.series
      .filter((series) => !categoryName || series.categoryName === categoryName)
      .sort((first, second) => first.position - second.position)
  }

  async create(categoryName: string, name: string) {
    this.series.push({
      id: `10000000-0000-4000-8000-${String(this.series.length + 1).padStart(12, '0')}`,
      categoryName,
      name,
      position: this.series.filter((series) => series.categoryName === categoryName).length,
    })
  }

  async move(id: string, direction: 'up' | 'down') {
    const current = this.series.find((series) => series.id === id)
    if (!current) return
    const ordered = await this.list(current.categoryName)
    const currentIndex = ordered.findIndex((series) => series.id === id)
    const target = ordered[currentIndex + (direction === 'up' ? -1 : 1)]
    if (!target) return
    const position = current.position
    current.position = target.position
    target.position = position
  }

  async remove(id: string) {
    if (this.used.has(id)) throw new Error('series_in_use')
    this.series = this.series.filter((series) => series.id !== id)
  }
}

function createActions(
  repository = new MemoryProductSeriesRepository(),
  rememberName?: (name: string) => Promise<void>,
) {
  const events: string[] = []
  return {
    actions: createProductSeriesActions({
      repository,
      requireAdmin: async () => { events.push('admin') },
      onChanged: async () => { events.push('changed') },
      rememberName,
    }),
    events,
    repository,
  }
}

describe('product series management', () => {
  it('trims and creates a series inside one category', async () => {
    const { actions, events, repository } = createActions()

    await expect(actions.create('上衣', '  Mori flora 漫花系列  ')).resolves.toEqual({
      ok: true,
      message: '系列「Mori flora 漫花系列」已新增',
    })
    await expect(repository.list('上衣')).resolves.toEqual([
      expect.objectContaining({ categoryName: '上衣', name: 'Mori flora 漫花系列', position: 0 }),
    ])
    expect(events).toEqual(['admin', 'changed'])
  })

  it('rejects blank, long and case-insensitive duplicate names', async () => {
    const { actions } = createActions()
    await expect(actions.create('', 'Mori flora')).resolves.toEqual({ ok: false, message: '請選擇商品分類' })
    await expect(actions.create('上衣', ' ')).resolves.toEqual({ ok: false, message: '請輸入系列名稱' })
    await expect(actions.create('上衣', 'a'.repeat(41))).resolves.toEqual({ ok: false, message: '系列名稱最多 40 個字' })
    await actions.create('上衣', 'Mori flora')
    await expect(actions.create('上衣', 'mori FLORA')).resolves.toEqual({ ok: false, message: '這個分類已有相同系列' })
  })

  it('moves only inside the same category', async () => {
    const { actions, repository } = createActions()
    await actions.create('上衣', '第一系列')
    await actions.create('上衣', '第二系列')
    await actions.create('褲裝', '褲裝系列')
    const second = (await repository.list('上衣'))[1]

    await expect(actions.move(second.id, 'up')).resolves.toEqual({ ok: true, message: '系列順序已更新' })
    expect((await repository.list('上衣')).map((series) => series.name)).toEqual(['第二系列', '第一系列'])
    expect((await repository.list('褲裝')).map((series) => series.name)).toEqual(['褲裝系列'])
  })

  it('refuses to delete a series that still has products', async () => {
    const { actions, repository } = createActions()
    await actions.create('上衣', '使用中系列')
    const series = (await repository.list('上衣'))[0]
    repository.used.add(series.id)

    await expect(actions.remove(series.id)).resolves.toEqual({
      ok: false,
      message: '仍有商品使用此系列，請先調整商品系列',
    })
  })

  it('remembers the created name so other categories can reuse it', async () => {
    const remembered: string[] = []
    const { actions } = createActions(
      new MemoryProductSeriesRepository(),
      async (name) => { remembered.push(name) },
    )

    await actions.create('上衣', '  Mori lumi 拾光系列  ')

    // Trimmed, matching what was stored as the series name.
    expect(remembered).toEqual(['Mori lumi 拾光系列'])
  })

  it('does not remember a name when the series itself was rejected', async () => {
    const remembered: string[] = []
    const repository = new MemoryProductSeriesRepository()
    const { actions } = createActions(repository, async (name) => { remembered.push(name) })

    await actions.create('上衣', 'Mori lumi 拾光系列')
    remembered.length = 0

    await expect(actions.create('上衣', 'mori lumi 拾光系列')).resolves.toMatchObject({ ok: false })
    expect(remembered).toEqual([])
  })

  it('still creates the series when remembering the name fails', async () => {
    const { actions, repository } = createActions(
      new MemoryProductSeriesRepository(),
      async () => { throw new Error('presets unavailable') },
    )

    await expect(actions.create('上衣', 'Mori lumi 拾光系列')).resolves.toMatchObject({ ok: true })
    expect((await repository.list('上衣')).map((item) => item.name)).toContain('Mori lumi 拾光系列')
  })
})
