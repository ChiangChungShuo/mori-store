import { isE2EMode } from '@/testing/e2e-mode'

export type ProductSeries = {
  id: string
  categoryName: string
  name: string
  position: number
}

export type SeriesActionState = { ok: boolean; message: string }

export interface ProductSeriesRepository {
  list(categoryName?: string): Promise<ProductSeries[]>
  create(categoryName: string, name: string): Promise<void>
  move(id: string, direction: 'up' | 'down'): Promise<void>
  remove(id: string): Promise<void>
}

type ProductSeriesDependencies = {
  repository: ProductSeriesRepository
  requireAdmin: () => Promise<unknown>
  onChanged?: () => void | Promise<void>
  /** Remembers the name as a reusable chip so other categories are one click. */
  rememberName?: (name: string) => Promise<void>
}

export function createProductSeriesActions(dependencies: ProductSeriesDependencies) {
  return {
    async create(categoryInput: string, nameInput: string): Promise<SeriesActionState> {
      await dependencies.requireAdmin()
      const categoryName = categoryInput.trim()
      const name = nameInput.trim()
      if (!categoryName) return { ok: false, message: '請選擇商品分類' }
      if (!name) return { ok: false, message: '請輸入系列名稱' }
      if (name.length > 40) return { ok: false, message: '系列名稱最多 40 個字' }

      const existing = await dependencies.repository.list(categoryName)
      if (existing.some((series) => series.name.toLocaleLowerCase('zh-Hant') === name.toLocaleLowerCase('zh-Hant'))) {
        return { ok: false, message: '這個分類已有相同系列' }
      }

      try {
        await dependencies.repository.create(categoryName, name)
      } catch {
        return { ok: false, message: '目前無法新增系列，請稍後再試' }
      }
      // Never fail the creation just because the chip could not be remembered.
      try {
        await dependencies.rememberName?.(name)
      } catch { /* the series itself is already saved */ }
      await dependencies.onChanged?.()
      return { ok: true, message: `系列「${name}」已新增` }
    },

    async move(idInput: string, direction: 'up' | 'down'): Promise<SeriesActionState> {
      await dependencies.requireAdmin()
      const id = idInput.trim()
      if (!id) return { ok: false, message: '請選擇要排序的系列' }
      try {
        await dependencies.repository.move(id, direction)
      } catch {
        return { ok: false, message: '目前無法調整系列順序，請稍後再試' }
      }
      await dependencies.onChanged?.()
      return { ok: true, message: '系列順序已更新' }
    },

    async remove(idInput: string): Promise<SeriesActionState> {
      await dependencies.requireAdmin()
      const id = idInput.trim()
      if (!id) return { ok: false, message: '請選擇要刪除的系列' }
      try {
        await dependencies.repository.remove(id)
      } catch (error) {
        if (error instanceof Error && error.message === 'series_in_use') {
          return { ok: false, message: '仍有商品使用此系列，請先調整商品系列' }
        }
        return { ok: false, message: '目前無法刪除系列，請稍後再試' }
      }
      await dependencies.onChanged?.()
      return { ok: true, message: '系列已刪除' }
    },
  }
}

function fixtureRepository(): ProductSeriesRepository {
  return {
    async list(categoryName) {
      const { getE2EStore } = await import('@/testing/e2e-store')
      return getE2EStore().productSeries
        .filter((series) => !categoryName || series.categoryName === categoryName)
        .sort((first, second) => first.position - second.position)
    },
    async create(categoryName, name) {
      const { randomUUID } = await import('node:crypto')
      const { getE2EStore } = await import('@/testing/e2e-store')
      const store = getE2EStore()
      store.productSeries.push({
        id: randomUUID(),
        categoryName,
        name,
        position: store.productSeries.filter((series) => series.categoryName === categoryName).length,
      })
    },
    async move(id, direction) {
      const { getE2EStore } = await import('@/testing/e2e-store')
      const store = getE2EStore()
      const current = store.productSeries.find((series) => series.id === id)
      if (!current) return
      const ordered = store.productSeries
        .filter((series) => series.categoryName === current.categoryName)
        .sort((first, second) => first.position - second.position)
      const currentIndex = ordered.findIndex((series) => series.id === id)
      const target = ordered[currentIndex + (direction === 'up' ? -1 : 1)]
      if (!target) return
      const position = current.position
      current.position = target.position
      target.position = position
    },
    async remove(id) {
      const { getE2EStore } = await import('@/testing/e2e-store')
      const store = getE2EStore()
      if (store.productSeriesProducts.some((assignment) => assignment.seriesId === id)) {
        throw new Error('series_in_use')
      }
      store.productSeries = store.productSeries.filter((series) => series.id !== id)
    },
  }
}

function liveRepository(): ProductSeriesRepository {
  return {
    async list(categoryName) {
      const { createClient } = await import('@/lib/supabase/server')
      let query = (await createClient())
        .from('product_series')
        .select('id, category_name, name, position')
        .order('position')
        .order('created_at')
      if (categoryName) query = query.eq('category_name', categoryName)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map((series) => ({
        id: series.id,
        categoryName: series.category_name,
        name: series.name,
        position: series.position,
      }))
    },
    async create(categoryName, name) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()
      const { data, error } = await admin
        .from('product_series')
        .select('position')
        .eq('category_name', categoryName)
        .order('position', { ascending: false })
        .limit(1)
      if (error) throw error
      const { error: insertError } = await admin.from('product_series').insert({
        category_name: categoryName,
        name,
        position: (data?.[0]?.position ?? -1) + 1,
      })
      if (insertError) throw insertError
    },
    async move(id, direction) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()
      const { data: current, error } = await admin
        .from('product_series')
        .select('id, category_name, position')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (!current) return
      let query = admin
        .from('product_series')
        .select('id, position')
        .eq('category_name', current.category_name)
      query = direction === 'up'
        ? query.lt('position', current.position).order('position', { ascending: false })
        : query.gt('position', current.position).order('position')
      const { data: adjacent, error: adjacentError } = await query.limit(1).maybeSingle()
      if (adjacentError) throw adjacentError
      if (!adjacent) return
      const { error: currentError } = await admin.from('product_series').update({ position: adjacent.position }).eq('id', current.id)
      if (currentError) throw currentError
      const { error: targetError } = await admin.from('product_series').update({ position: current.position }).eq('id', adjacent.id)
      if (targetError) throw targetError
    },
    async remove(id) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()
      const { count, error: countError } = await admin
        .from('product_series_products')
        .select('product_id', { count: 'exact', head: true })
        .eq('series_id', id)
      if (countError) throw countError
      if ((count ?? 0) > 0) throw new Error('series_in_use')
      const { error } = await admin.from('product_series').delete().eq('id', id)
      if (error) throw error
    },
  }
}

export function resolvedProductSeriesRepository() {
  return isE2EMode() ? fixtureRepository() : liveRepository()
}

export async function listProductSeries(categoryName?: string) {
  if (isE2EMode()) return fixtureRepository().list(categoryName)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return []
  return liveRepository().list(categoryName)
}

async function revalidateProductSeriesPaths() {
  const { revalidatePath } = await import('next/cache')
  for (const path of ['/', '/products', '/admin/categories', '/admin/products', '/admin/products/new']) {
    revalidatePath(path)
  }
}

function serverActions() {
  return createProductSeriesActions({
    repository: resolvedProductSeriesRepository(),
    requireAdmin: async () => {
      const { requireAdmin } = await import('@/lib/auth/require-admin')
      return requireAdmin()
    },
    onChanged: revalidateProductSeriesPaths,
    rememberName: async (name) => {
      const { rememberContentPreset } = await import('@/features/catalog/content-presets')
      await rememberContentPreset('series', name)
    },
  })
}

export async function createProductSeriesFromForm(
  _state: SeriesActionState,
  formData: FormData,
) {
  'use server'
  return serverActions().create(
    String(formData.get('categoryName') ?? ''),
    String(formData.get('name') ?? ''),
  )
}

export async function moveProductSeriesFromForm(
  _state: SeriesActionState,
  formData: FormData,
) {
  'use server'
  const direction = formData.get('direction') === 'up' ? 'up' : 'down'
  return serverActions().move(String(formData.get('id') ?? ''), direction)
}

export async function deleteProductSeriesFromForm(
  _state: SeriesActionState,
  formData: FormData,
) {
  'use server'
  return serverActions().remove(String(formData.get('id') ?? ''))
}
