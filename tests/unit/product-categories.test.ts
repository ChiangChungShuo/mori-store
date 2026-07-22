import { afterEach, describe, expect, it, vi } from 'vitest'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { listProductCategories } from '@/features/catalog/categories'

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

function configureQuery(data: Array<{ category: string | null }>) {
  const order = vi.fn().mockResolvedValue({ data, error: null })
  const eq = vi.fn().mockReturnValue({ order })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  createClient.mockResolvedValue({ from })
  return { eq, from, order, select }
}

describe('listProductCategories', () => {
  it('reads published product categories through the typed products query', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-key')
    const query = configureQuery([
      { category: '褲裝' },
      { category: ' 上衣 ' },
      { category: '褲裝' },
      { category: '' },
      { category: null },
    ])

    await expect(listProductCategories()).resolves.toEqual(['上衣', '褲裝'])
    expect(query.from).toHaveBeenCalledWith('products')
    expect(query.select).toHaveBeenCalledWith('category')
    expect(query.eq).toHaveBeenCalledWith('is_published', true)
    expect(query.order).toHaveBeenCalledWith('category')
  })

  it('falls back to defaults when the query has no usable categories', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-key')
    configureQuery([{ category: '  ' }, { category: null }])

    await expect(listProductCategories()).resolves.toEqual(['上衣', '褲裝', '洋裝', '外套', '幼兒服'])
  })
})
