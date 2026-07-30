import { afterEach, describe, expect, it, vi } from 'vitest'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { listProductCategories } from '@/features/catalog/categories'

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

function configureQuery(data: Array<{ name: string | null }>) {
  const orderByCreated = vi.fn().mockResolvedValue({ data, error: null })
  const orderByPosition = vi.fn().mockReturnValue({ order: orderByCreated })
  const select = vi.fn().mockReturnValue({ order: orderByPosition })
  const from = vi.fn().mockReturnValue({ select })
  createClient.mockResolvedValue({ from })
  return { from, select, orderByPosition, orderByCreated }
}

describe('listProductCategories', () => {
  it('reads the managed product_categories table in position order', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-key')
    const query = configureQuery([
      { name: '上衣' },
      { name: ' 褲裝 ' },
      { name: '' },
      { name: null },
    ])

    await expect(listProductCategories()).resolves.toEqual(['上衣', '褲裝'])
    expect(query.from).toHaveBeenCalledWith('product_categories')
    expect(query.select).toHaveBeenCalledWith('name')
    expect(query.orderByPosition).toHaveBeenCalledWith('position')
    expect(query.orderByCreated).toHaveBeenCalledWith('created_at')
  })

  it('falls back to defaults when the table has no usable categories', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-key')
    configureQuery([{ name: '  ' }, { name: null }])

    await expect(listProductCategories()).resolves.toEqual(['上衣', '褲裝', '洋裝', '外套', '幼兒服'])
  })
})
