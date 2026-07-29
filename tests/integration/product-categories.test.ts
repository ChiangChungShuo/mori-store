import { describe, expect, it } from 'vitest'
import {
  createProductCategoryActions,
  type ProductCategoryRepository,
} from '@/features/catalog/categories'

class MemoryCategoryRepository implements ProductCategoryRepository {
  categories = ['上衣', '褲裝']

  async list() {
    return this.categories
  }

  async create(name: string) {
    if (this.categories.includes(name)) throw new Error('duplicate')
    this.categories.push(name)
  }
}

describe('product category management', () => {
  it('authorizes, trims and creates a category used by the storefront', async () => {
    const repository = new MemoryCategoryRepository()
    const events: string[] = []
    const actions = createProductCategoryActions({
      repository,
      requireAdmin: async () => { events.push('admin') },
      onChanged: async () => { events.push('changed') },
    })

    await expect(actions.create('  親子配件  ')).resolves.toEqual({
      ok: true,
      message: '分類「親子配件」已新增',
    })
    await expect(repository.list()).resolves.toEqual(['上衣', '褲裝', '親子配件'])
    expect(events).toEqual(['admin', 'changed'])
  })

  it('rejects blank and duplicate category names', async () => {
    const repository = new MemoryCategoryRepository()
    const actions = createProductCategoryActions({
      repository,
      requireAdmin: async () => undefined,
    })

    await expect(actions.create(' ')).resolves.toEqual({ ok: false, message: '請輸入分類名稱' })
    await expect(actions.create('上衣')).resolves.toEqual({ ok: false, message: '這個分類已經存在' })
  })
})
