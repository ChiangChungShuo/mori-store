import type { AgeBand } from '@/types/store'
import type { CartVariantSnapshot } from '@/features/cart/refresh'

const CATALOG_CONFIGURATION_ERROR = 'MORI catalog configuration error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.'

type CatalogEnvironment = {
  NODE_ENV?: string
  NEXT_PHASE?: string
  NEXT_PUBLIC_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string
}

export function resolveCatalogConfiguration(
  environment: CatalogEnvironment = process.env,
) {
  const configured = Boolean(
    environment.NEXT_PUBLIC_SUPABASE_URL
    && environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
  if (configured) return true
  if (environment.NODE_ENV !== 'production'
    || environment.NEXT_PHASE === 'phase-production-build') return false

  throw new Error(CATALOG_CONFIGURATION_ERROR)
}

export type ProductFilters = {
  age?: '0-2' | '3-5' | '6-9' | '10-12'
  size?: string
  color?: string
  category?: string
  inStock?: boolean
}

export type CatalogVariant = {
  id: string
  sku: string
  color: string
  size: string
  price: number
  compareAtPrice: number | null
  stock: number
}

export type CatalogProduct = {
  id: string
  slug: string
  name: string
  description: string
  category: string
  ageBands: readonly AgeBand[]
  material: string
  careInstructions: string
  sizeGuide: string
  isNew: boolean
  imageUrl: string | null
  imageAlt: string
  variants: readonly CatalogVariant[]
}

type SearchParams = Record<string, string | string[] | undefined>

const ageBands: ProductFilters['age'][] = ['0-2', '3-5', '6-9', '10-12']

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export function parseProductFilters(searchParams: SearchParams): ProductFilters {
  const age = first(searchParams.age)
  const size = first(searchParams.size)
  const color = first(searchParams.color)
  const category = first(searchParams.category)
  const inStock = first(searchParams.inStock)

  return {
    ...(ageBands.includes(age as ProductFilters['age']) ? { age: age as ProductFilters['age'] } : {}),
    ...(size ? { size } : {}),
    ...(color ? { color } : {}),
    ...(category ? { category } : {}),
    ...(inStock === 'true' ? { inStock: true } : {}),
  }
}

type ProductRecord = {
  id: string
  slug: string
  name: string
  description: string
  category: string
  age_bands: AgeBand[]
  material: string
  care_instructions: string
  size_guide: string
  is_new: boolean
  product_images: Array<{ storage_path: string; alt_text: string; position: number }>
  product_variants: Array<{
    id: string
    sku: string
    color: string
    size: string
    price: number
    compare_at_price: number | null
    stock: number
  }>
}

function publicImageUrl(storagePath: string) {
  if (/^https?:\/\//.test(storagePath)) return storagePath
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!baseUrl) return storagePath
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/')
  return `${baseUrl}/storage/v1/object/public/product-images/${encodedPath}`
}

function mapProduct(record: ProductRecord): CatalogProduct {
  const image = [...record.product_images].sort((a, b) => a.position - b.position)[0]

  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description,
    category: record.category,
    ageBands: record.age_bands,
    material: record.material,
    careInstructions: record.care_instructions,
    sizeGuide: record.size_guide,
    isNew: record.is_new,
    imageUrl: image ? publicImageUrl(image.storage_path) : null,
    imageAlt: image?.alt_text ?? record.name,
    variants: [...record.product_variants]
      .sort((a, b) => a.size.localeCompare(b.size, 'zh-Hant', { numeric: true }))
      .map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
        price: variant.price,
        compareAtPrice: variant.compare_at_price,
        stock: variant.stock,
      })),
  }
}

const productFields = `
  id, slug, name, description, category, age_bands, material,
  care_instructions, size_guide, is_new,
  product_images(storage_path, alt_text, position),
  product_variants(id, sku, color, size, price, compare_at_price, stock),
  matching_variants:product_variants!inner(id, size, color, stock)
`

export async function listProducts(filters: ProductFilters): Promise<CatalogProduct[]> {
  if (!resolveCatalogConfiguration()) return []

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  let query = supabase
    .from('products')
    .select(productFields)
    .eq('is_published', true)

  if (filters.age) query = query.contains('age_bands', [filters.age])
  if (filters.category) query = query.eq('category', filters.category)
  if (filters.size) query = query.eq('matching_variants.size', filters.size)
  if (filters.color) query = query.eq('matching_variants.color', filters.color)
  if (filters.inStock) query = query.gt('matching_variants.stock', 0)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error

  return ((data ?? []) as unknown as ProductRecord[]).map(mapProduct)
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  if (!resolveCatalogConfiguration()) return null

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select(productFields)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()

  if (error) throw error
  return data ? mapProduct(data as unknown as ProductRecord) : null
}

type CartVariantRecord = {
  id: string
  color: string
  size: string
  price: number
  stock: number
  products: {
    slug: string
    name: string
    is_published: boolean
    product_images: Array<{ storage_path: string; position: number }>
  }
}

export async function getPublishedCartVariants(
  variantIds: string[],
): Promise<CartVariantSnapshot[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL
    || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(CATALOG_CONFIGURATION_ERROR)
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('product_variants')
    .select(`
      id, color, size, price, stock,
      products!inner(
        slug, name, is_published,
        product_images(storage_path, position)
      )
    `)
    .in('id', variantIds)
    .eq('products.is_published', true)

  if (error) throw error

  return ((data ?? []) as unknown as CartVariantRecord[]).map((variant) => {
    const image = [...variant.products.product_images]
      .sort((a, b) => a.position - b.position)[0]

    return {
      variantId: variant.id,
      productSlug: variant.products.slug,
      name: variant.products.name,
      imageUrl: image ? publicImageUrl(image.storage_path) : null,
      color: variant.color,
      size: variant.size,
      unitPrice: variant.price,
      maxStock: variant.stock,
    }
  })
}
