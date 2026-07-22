import { defaultProductCategories } from '@/features/catalog/category-defaults'

export async function listProductCategories() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return [...defaultProductCategories]
  }
  const { createClient } = await import('@/lib/supabase/server')
  const { data, error } = await (await createClient())
    .from('products')
    .select('category')
    .eq('is_published', true)
    .order('category')
  if (error) throw error
  const categories = [...new Set((data ?? []).flatMap(({ category }) => {
    const name = category?.trim()
    return name ? [name] : []
  }))].sort((left, right) => left.localeCompare(right, 'zh-Hant'))
  return categories.length ? categories : [...defaultProductCategories]
}
