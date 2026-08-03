import type { AgeBand } from '@/types/store'
import type { CartVariantSnapshot } from '@/features/cart/refresh'
import { isE2EMode } from '@/testing/e2e-mode'
import type { ProductSeries } from '@/features/catalog/product-series'
import type { CatalogProductImage } from '@/features/catalog/product-images'

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
  q?: string
  age?: '0-3' | '3-6' | '6-12'
  size?: string
  color?: string
  category?: string
  series?: string
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
  summary?: string
  tags?: readonly string[]
  seoTitle?: string
  seoDescription?: string
  category: string
  series: readonly ProductSeries[]
  ageBands: readonly AgeBand[]
  material: string
  careInstructions: string
  sizeGuide: string
  isNew: boolean
  availableAt?: string | null
  imageUrl: string | null
  imageAlt: string
  images?: readonly CatalogProductImage[]
  variants: readonly CatalogVariant[]
  /** "buy N for NT$X" tiers, when the product has any. */
  quantityPrices?: readonly { quantity: number; bundlePrice: number }[]
}

type SearchParams = Record<string, string | string[] | undefined>

const ageBands: ProductFilters['age'][] = ['0-3', '3-6', '6-12']

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export function parseProductFilters(searchParams: SearchParams): ProductFilters {
  const age = first(searchParams.age)
  const q = first(searchParams.q)?.trim()
  const size = first(searchParams.size)
  const color = first(searchParams.color)
  const category = first(searchParams.category)?.trim()
  const series = first(searchParams.series)?.trim()
  const inStock = first(searchParams.inStock)

  return {
    ...(q ? { q: q.slice(0, 120) } : {}),
    ...(ageBands.includes(age as ProductFilters['age']) ? { age: age as ProductFilters['age'] } : {}),
    ...(size ? { size } : {}),
    ...(color ? { color } : {}),
    ...(category ? { category } : {}),
    ...(category && series ? { series } : {}),
    ...(inStock === 'true' ? { inStock: true } : {}),
  }
}

type ProductRecord = {
  id: string
  slug: string
  name: string
  description: string
  summary?: string | null
  tags?: string[] | null
  seo_title?: string | null
  seo_description?: string | null
  category: string
  product_series_products: Array<{
    product_series: {
      id: string
      category_name: string
      name: string
      position: number
    } | null
  }>
  age_bands: AgeBand[]
  material: string
  care_instructions: string
  size_guide: string
  is_new: boolean
  available_at: string | null
  product_images: Array<{ storage_path: string; alt_text: string; position: number; color: string | null }>
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
  const images = [...record.product_images]
    .sort((a, b) => a.position - b.position)
    .map((image) => ({
      url: publicImageUrl(image.storage_path),
      alt: image.alt_text || record.name,
      color: image.color,
    }))
  const image = images[0]

  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description,
    summary: record.summary ?? '',
    tags: record.tags ?? [],
    seoTitle: record.seo_title ?? '',
    seoDescription: record.seo_description ?? '',
    category: record.category,
    series: record.product_series_products.flatMap((assignment) => assignment.product_series ? [{
      id: assignment.product_series.id,
      categoryName: assignment.product_series.category_name,
      name: assignment.product_series.name,
      position: assignment.product_series.position,
    }] : []).sort((first, second) => first.position - second.position),
    ageBands: record.age_bands,
    material: record.material,
    careInstructions: record.care_instructions,
    sizeGuide: record.size_guide,
    isNew: record.is_new,
    availableAt: record.available_at,
    imageUrl: image?.url ?? null,
    imageAlt: image?.alt ?? record.name,
    images,
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

export function applyCatalogFilters(products: CatalogProduct[], filters: ProductFilters) {
  const term = filters.q?.toLocaleLowerCase('zh-Hant')
  return products.filter((product) => {
    const searchable = [
      product.name,
      product.description,
      product.category,
      product.material,
      ...product.series.map((series) => series.name),
      ...product.variants.flatMap((variant) => [variant.color, variant.size, variant.sku]),
    ].join(' ').toLocaleLowerCase('zh-Hant')
    return (!term || searchable.includes(term))
      && (!filters.age || product.ageBands.includes(filters.age))
      && (!filters.size || product.variants.some((variant) => variant.size === filters.size))
      && (!filters.color || product.variants.some((variant) => variant.color.includes(filters.color!)))
      && (!filters.category || product.category === filters.category)
      && (!filters.series || product.series.some((series) => (
        series.categoryName === filters.category && series.name === filters.series
      )))
      && (!filters.inStock || product.variants.some((variant) => variant.stock > 0))
  })
}

const productFields = `
  id, slug, name, description, summary, tags, seo_title, seo_description,
  category, age_bands, material,
  care_instructions, size_guide, is_new, available_at,
  product_series_products(product_series(id, category_name, name, position)),
  product_images(storage_path, alt_text, position, color),
  product_variants(id, sku, color, size, price, compare_at_price, stock),
  matching_variants:product_variants!inner(id, size, color, stock)
`

// Distinct sizes available across published products, for the size filter
// dropdown. Numeric sizes sort ascending, then any lettered ones.
export function sortSizeOptions(sizes: Iterable<string>): string[] {
  return [...new Set([...sizes].map((size) => size.trim()).filter(Boolean))].sort((a, b) => {
    const first = Number(a)
    const second = Number(b)
    const firstNumeric = Number.isFinite(first)
    const secondNumeric = Number.isFinite(second)
    if (firstNumeric && secondNumeric) return first - second
    if (firstNumeric) return -1
    if (secondNumeric) return 1
    return a.localeCompare(b, 'zh-Hant')
  })
}

export async function listAvailableColors(): Promise<string[]> {
  if (isE2EMode()) {
    const { listE2EProducts } = await import('@/testing/e2e-storefront-fixtures')
    const products = await listE2EProducts({})
    return [...new Set(products.flatMap((product) => product.variants.map((variant) => variant.color.trim())).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'zh-Hant'))
  }
  if (!resolveCatalogConfiguration()) return []

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('product_variants')
      .select('color, products!inner(is_published)')
      .eq('is_active', true)
      .eq('products.is_published', true)
    if (error) throw error
    return [...new Set((data ?? []).map((row) => (row.color as string).trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'zh-Hant'))
  } catch {
    // The dropdown is an enhancement; an empty list falls back gracefully.
    return []
  }
}

export async function listAvailableSizes(): Promise<string[]> {
  if (isE2EMode()) {
    const { listE2EProducts } = await import('@/testing/e2e-storefront-fixtures')
    const products = await listE2EProducts({})
    return sortSizeOptions(products.flatMap((product) => product.variants.map((variant) => variant.size)))
  }
  if (!resolveCatalogConfiguration()) return []

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('product_variants')
      .select('size, products!inner(is_published)')
      .eq('is_active', true)
      .eq('products.is_published', true)
    if (error) throw error
    return sortSizeOptions((data ?? []).map((row) => row.size as string))
  } catch {
    // The dropdown is an enhancement; an empty list falls back gracefully.
    return []
  }
}

export async function listProducts(filters: ProductFilters): Promise<CatalogProduct[]> {
  if (isE2EMode()) {
    const { listE2EProducts } = await import('@/testing/e2e-storefront-fixtures')
    return listE2EProducts(filters)
  }
  if (!resolveCatalogConfiguration()) return []

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  let query = supabase
    .from('products')
    .select(productFields)
    .eq('is_published', true)
    .eq('product_variants.is_active', true)
    .eq('matching_variants.is_active', true)

  if (filters.age) query = query.contains('age_bands', [filters.age])
  if (filters.category) query = query.eq('category', filters.category)
  if (filters.size) query = query.eq('matching_variants.size', filters.size)
  if (filters.color) query = query.eq('matching_variants.color', filters.color)
  if (filters.inStock) query = query.gt('matching_variants.stock', 0)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error

  const products = applyCatalogFilters(((data ?? []) as unknown as ProductRecord[]).map(mapProduct), filters)
  // One extra lightweight query so listing cards can show the bundle badge.
  const { getQuantityPriceMap } = await import('@/features/catalog/quantity-prices')
  const tiers = await getQuantityPriceMap()
  return products.map((product) => (
    tiers[product.slug]?.length ? { ...product, quantityPrices: tiers[product.slug] } : product
  ))
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  if (isE2EMode()) {
    const { getE2EProduct } = await import('@/testing/e2e-storefront-fixtures')
    return getE2EProduct(slug)
  }
  if (!resolveCatalogConfiguration()) return null

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select(productFields)
    .eq('slug', slug)
    .eq('is_published', true)
    .eq('product_variants.is_active', true)
    .eq('matching_variants.is_active', true)
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
    available_at: string | null
    product_images: Array<{ storage_path: string; position: number }>
  }
}

export async function getPublishedCartVariants(
  variantIds: string[],
): Promise<CartVariantSnapshot[]> {
  if (isE2EMode()) {
    const { getE2ECartVariants } = await import('@/testing/e2e-storefront-fixtures')
    return getE2ECartVariants(variantIds)
  }
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
        slug, name, is_published, available_at,
        product_images(storage_path, position)
      )
    `)
    .in('id', variantIds)
    .eq('is_active', true)
    .eq('products.is_published', true)

  if (error) throw error

  return ((data ?? []) as unknown as CartVariantRecord[])
    .filter((variant) => !variant.products.available_at || new Date(variant.products.available_at) <= new Date())
    .map((variant) => {
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
