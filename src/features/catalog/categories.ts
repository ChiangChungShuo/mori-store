import { defaultProductCategories } from '@/features/catalog/category-defaults'

type CategoryResult = { data: Array<{ name: string }> | null; error: unknown }
type CategoryQuery = PromiseLike<CategoryResult> & {
  select(columns: string): CategoryQuery
  order(column: string): CategoryQuery
}

export async function listProductCategories() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return [...defaultProductCategories]
  }
  const { createClient } = await import('@/lib/supabase/server')
  const client = await createClient() as unknown as { from(table: string): CategoryQuery }
  const { data, error } = await client
    .from('product_categories')
    .select('name')
    .order('position')
    .order('created_at')
  if (error) throw error
  return (data ?? []).map((category) => category.name)
}
