import { isE2EMode } from '@/testing/e2e-mode'
import { defaultProductCategories } from '@/features/catalog/category-defaults'

export interface ProductCategoryRepository {
  list(): Promise<string[]>
  create(name: string): Promise<void>
}

type CategoryDependencies = {
  repository: ProductCategoryRepository
  requireAdmin: () => Promise<unknown>
  onChanged?: () => void | Promise<void>
}

export function createProductCategoryActions(dependencies: CategoryDependencies) {
  return {
    async create(input: string) {
      await dependencies.requireAdmin()
      const name = input.trim()
      if (!name) return { ok: false, message: '請輸入分類名稱' }
      if (name.length > 24) return { ok: false, message: '分類名稱最多 24 個字' }

      const categories = await dependencies.repository.list()
      if (categories.some((category) => category.toLocaleLowerCase('zh-Hant') === name.toLocaleLowerCase('zh-Hant'))) {
        return { ok: false, message: '這個分類已經存在' }
      }

      try {
        await dependencies.repository.create(name)
      } catch {
        return { ok: false, message: '目前無法新增分類，請稍後再試' }
      }
      await dependencies.onChanged?.()
      return { ok: true, message: `分類「${name}」已新增` }
    },
  }
}

function fixtureRepository(): ProductCategoryRepository {
  return {
    async list() {
      const { getE2EStore } = await import('@/testing/e2e-store')
      return [...getE2EStore().productCategories]
    },
    async create(name) {
      const { getE2EStore } = await import('@/testing/e2e-store')
      getE2EStore().productCategories.push(name)
    },
  }
}

function liveRepository(): ProductCategoryRepository {
  return {
    async list() {
      const { createClient } = await import('@/lib/supabase/server')
      const { data, error } = await (await createClient())
        .from('product_categories')
        .select('name')
        .order('position')
        .order('created_at')
      if (error) throw error
      return (data ?? []).map((category) => category.name)
    },
    async create(name) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const { data, error } = await createAdminClient()
        .from('product_categories')
        .select('position')
        .order('position', { ascending: false })
        .limit(1)
      if (error) throw error
      const position = (data?.[0]?.position ?? -1) + 1
      const { error: insertError } = await createAdminClient()
        .from('product_categories')
        .insert({ name, position })
      if (insertError) throw insertError
    },
  }
}

function resolvedRepository() {
  return isE2EMode() ? fixtureRepository() : liveRepository()
}

export async function listProductCategories() {
  if (isE2EMode()) return fixtureRepository().list()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return [...defaultProductCategories]
  }
  // The product_categories table is the managed source of truth: categories
  // added in the admin appear here immediately, even before any product uses
  // them. (Reading distinct products.category would hide brand-new categories.)
  const { createClient } = await import('@/lib/supabase/server')
  const { data, error } = await (await createClient())
    .from('product_categories')
    .select('name')
    .order('position')
    .order('created_at')
  if (error) throw error
  const categories = [...new Set((data ?? []).flatMap((row) => {
    const name = row.name?.trim()
    return name ? [name] : []
  }))]
  return categories.length ? categories : [...defaultProductCategories]
}

export async function createProductCategory(
  _previousState: { ok: boolean; message: string },
  formData: FormData,
) {
  'use server'
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  const actions = createProductCategoryActions({
    repository: resolvedRepository(),
    requireAdmin,
    onChanged: async () => {
      const { revalidatePath } = await import('next/cache')
      for (const path of ['/', '/products', '/admin/categories', '/admin/products', '/admin/products/new']) revalidatePath(path)
    },
  })
  return actions.create(String(formData.get('name') ?? ''))
}
