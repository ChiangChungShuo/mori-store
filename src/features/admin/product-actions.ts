import { z } from 'zod'
import {
  productImageSchema,
  productSchema,
  type ProductInput,
} from '@/lib/validation/product'
import type { Database } from '@/types/database'

type ActionResult = {
  ok: boolean
  message?: string
  productId?: string
  fieldErrors?: Record<string, string[] | undefined>
}

export type AdminProductSummary = {
  id: string
  name: string
  isPublished: boolean
  totalStock: number
  imageUrl: string | null
  imageAlt: string
}

export type AdminProductDetail = {
  id: string
  isPublished: boolean
  product: ProductInput
  images: Array<{ id: string; url: string; alt: string }>
}

type PublishReadiness = {
  imageCount: number
  inStockVariantCount: number
}

export interface ProductRepository {
  createProduct(input: ProductInput): Promise<string>
  updateProduct(productId: string, input: ProductInput): Promise<void>
  getPublishReadiness(productId: string): Promise<PublishReadiness>
  setPublished(productId: string, published: boolean): Promise<void>
  uploadFile(path: string, file: File): Promise<void>
  insertImage(productId: string, path: string, alt: string): Promise<void>
  removeFile(path: string): Promise<void>
}

type AdminProductDependencies = {
  repository: ProductRepository
  requireAdmin: () => Promise<unknown>
  randomUUID?: () => string
  onChanged?: (productId: string) => void | Promise<void>
}

const productIdSchema = z.string().uuid()

function validationFailure(error: z.ZodError): ActionResult {
  return {
    ok: false,
    message: '請檢查商品資料',
    fieldErrors: error.flatten().fieldErrors,
  }
}

export function createAdminProductActions(dependencies: AdminProductDependencies) {
  const randomUUID = dependencies.randomUUID ?? (() => crypto.randomUUID())
  const changed = dependencies.onChanged ?? (() => undefined)

  return {
    async createProduct(input: unknown): Promise<ActionResult> {
      await dependencies.requireAdmin()
      const parsed = productSchema.safeParse(input)
      if (!parsed.success) return validationFailure(parsed.error)

      try {
        const productId = await dependencies.repository.createProduct(parsed.data)
        await changed(productId)
        return { ok: true, productId }
      } catch {
        return { ok: false, message: '目前無法建立商品，請稍後再試' }
      }
    },

    async updateProduct(productId: string, input: unknown): Promise<ActionResult> {
      await dependencies.requireAdmin()
      const id = productIdSchema.safeParse(productId)
      const parsed = productSchema.safeParse(input)
      if (!id.success || !parsed.success) {
        return parsed.success
          ? { ok: false, message: '商品不存在' }
          : validationFailure(parsed.error)
      }

      try {
        await dependencies.repository.updateProduct(id.data, parsed.data)
        await changed(id.data)
        return { ok: true, productId: id.data }
      } catch {
        return { ok: false, message: '目前無法更新商品，請稍後再試' }
      }
    },

    async setProductPublished(productId: string, published: boolean): Promise<ActionResult> {
      await dependencies.requireAdmin()
      const id = productIdSchema.safeParse(productId)
      if (!id.success) return { ok: false, message: '商品不存在' }

      try {
        if (published) {
          const readiness = await dependencies.repository.getPublishReadiness(id.data)
          if (readiness.imageCount < 1) {
            return { ok: false, message: '商品至少需要一張圖片才能上架' }
          }
          if (readiness.inStockVariantCount < 1) {
            return { ok: false, message: '商品至少需要一個有庫存的規格才能上架' }
          }
        }

        await dependencies.repository.setPublished(id.data, published)
        await changed(id.data)
        return { ok: true, productId: id.data }
      } catch {
        return { ok: false, message: '目前無法變更上架狀態，請稍後再試' }
      }
    },

    async uploadProductImage(productId: string, input: unknown): Promise<ActionResult> {
      await dependencies.requireAdmin()
      const id = productIdSchema.safeParse(productId)
      const parsed = productImageSchema.safeParse(input)
      if (!id.success || !parsed.success) {
        return parsed.success
          ? { ok: false, message: '商品不存在' }
          : validationFailure(parsed.error)
      }

      const extension = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      }[parsed.data.file.type]
      const path = `${id.data}/${randomUUID()}.${extension}`

      try {
        await dependencies.repository.uploadFile(path, parsed.data.file)
      } catch {
        return { ok: false, message: '目前無法上傳圖片，請稍後再試' }
      }

      try {
        await dependencies.repository.insertImage(id.data, path, parsed.data.alt)
      } catch {
        try {
          await dependencies.repository.removeFile(path)
        } catch {
          // Preserve the database failure result; storage cleanup can be retried operationally.
        }
        return { ok: false, message: '目前無法儲存圖片資料，請稍後再試' }
      }

      await changed(id.data)
      return { ok: true, productId: id.data }
    },
  }
}

type ProductInsert = Database['public']['Tables']['products']['Insert']
type VariantInsert = Database['public']['Tables']['product_variants']['Insert']

function productRow(input: ProductInput): ProductInsert {
  return {
    name: input.name,
    slug: input.slug,
    category: input.category,
    age_bands: input.ageBands,
    description: input.description,
    material: input.material,
    care_instructions: input.careInstructions,
    size_guide: input.sizeGuide,
    is_new: input.isNew,
  }
}

function variantRows(productId: string, input: ProductInput): VariantInsert[] {
  return input.variants.map((variant) => ({
    product_id: productId,
    sku: variant.sku,
    color: variant.color,
    size: variant.size,
    price: variant.price,
    compare_at_price: variant.compareAtPrice ?? null,
    stock: variant.stock,
  }))
}

function createSupabaseProductRepository(): ProductRepository {
  async function client() {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    return createAdminClient()
  }

  return {
    async createProduct(input) {
      const supabase = await client()
      const { data, error } = await supabase
        .from('products')
        .insert(productRow(input))
        .select('id')
        .single()
      if (error) throw error

      const variants = await supabase.from('product_variants').insert(variantRows(data.id, input))
      if (variants.error) {
        await supabase.from('products').delete().eq('id', data.id)
        throw variants.error
      }
      return data.id
    },

    async updateProduct(productId, input) {
      const supabase = await client()
      const { data: currentProduct, error: productError } = await supabase
        .from('products')
        .select('name, slug, category, age_bands, description, material, care_instructions, size_guide, is_new')
        .eq('id', productId)
        .single()
      if (productError) throw productError

      const { data: currentVariants, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, product_id, sku, color, size, price, compare_at_price, stock')
        .eq('product_id', productId)
      if (variantsError) throw variantsError

      const existingBySku = new Map(currentVariants.map((variant) => [variant.sku, variant]))
      const requestedSkus = new Set(input.variants.map((variant) => variant.sku))
      const insertedIds: string[] = []

      try {
        for (const variant of variantRows(productId, input)) {
          const existing = existingBySku.get(variant.sku)
          if (existing) {
            const { error } = await supabase.from('product_variants').update({
              color: variant.color,
              size: variant.size,
              price: variant.price,
              compare_at_price: variant.compare_at_price,
              stock: variant.stock,
            }).eq('id', existing.id)
            if (error) throw error
          } else {
            const { data, error } = await supabase
              .from('product_variants')
              .insert(variant)
              .select('id')
              .single()
            if (error) throw error
            insertedIds.push(data.id)
          }
        }

        for (const variant of currentVariants) {
          if (!requestedSkus.has(variant.sku)) {
            const { error } = await supabase.from('product_variants').delete().eq('id', variant.id)
            if (error) throw error
          }
        }

        const { error } = await supabase.from('products').update(productRow(input)).eq('id', productId)
        if (error) throw error
      } catch (error) {
        if (insertedIds.length > 0) {
          await supabase.from('product_variants').delete().in('id', insertedIds)
        }
        await supabase.from('product_variants').upsert(currentVariants, { onConflict: 'id' })
        await supabase.from('products').update(currentProduct).eq('id', productId)
        throw error
      }
    },

    async getPublishReadiness(productId) {
      const supabase = await client()
      const [images, variants] = await Promise.all([
        supabase.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', productId),
        supabase.from('product_variants').select('id', { count: 'exact', head: true }).eq('product_id', productId).gt('stock', 0),
      ])
      if (images.error) throw images.error
      if (variants.error) throw variants.error
      return { imageCount: images.count ?? 0, inStockVariantCount: variants.count ?? 0 }
    },

    async setPublished(productId, published) {
      const supabase = await client()
      const { error } = await supabase
        .from('products')
        .update({ is_published: published })
        .eq('id', productId)
      if (error) throw error
    },

    async uploadFile(path, file) {
      const supabase = await client()
      const { error } = await supabase.storage
        .from('product-images')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw error
    },

    async insertImage(productId, path, alt) {
      const supabase = await client()
      const { data: lastImage, error: positionError } = await supabase
        .from('product_images')
        .select('position')
        .eq('product_id', productId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (positionError) throw positionError

      const { error } = await supabase.from('product_images').insert({
        product_id: productId,
        storage_path: path,
        alt_text: alt,
        position: (lastImage?.position ?? -1) + 1,
      })
      if (error) throw error
    },

    async removeFile(path) {
      const supabase = await client()
      const { error } = await supabase.storage.from('product-images').remove([path])
      if (error) throw error
    },
  }
}

function productImageUrl(storagePath: string) {
  if (/^https?:\/\//.test(storagePath)) return storagePath
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/')
  return `${baseUrl}/storage/v1/object/public/product-images/${encodedPath}`
}

export async function listAdminProducts(): Promise<AdminProductSummary[]> {
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { data, error } = await createAdminClient()
    .from('products')
    .select(`
      id, name, is_published,
      product_images(storage_path, alt_text, position),
      product_variants(stock)
    `)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((record) => {
    const image = [...record.product_images].sort((a, b) => a.position - b.position)[0]
    return {
      id: record.id,
      name: record.name,
      isPublished: record.is_published,
      totalStock: record.product_variants.reduce((total, variant) => total + variant.stock, 0),
      imageUrl: image ? productImageUrl(image.storage_path) : null,
      imageAlt: image?.alt_text ?? record.name,
    }
  })
}

export async function getAdminProduct(productId: string): Promise<AdminProductDetail | null> {
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()
  const id = productIdSchema.safeParse(productId)
  if (!id.success) return null

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { data, error } = await createAdminClient()
    .from('products')
    .select(`
      id, name, slug, category, age_bands, description, material,
      care_instructions, size_guide, is_new, is_published,
      product_images(id, storage_path, alt_text, position),
      product_variants(sku, color, size, price, compare_at_price, stock)
    `)
    .eq('id', id.data)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    isPublished: data.is_published,
    product: {
      name: data.name,
      slug: data.slug,
      category: data.category,
      ageBands: data.age_bands,
      description: data.description,
      material: data.material,
      careInstructions: data.care_instructions,
      sizeGuide: data.size_guide,
      isNew: data.is_new,
      variants: data.product_variants.map((variant) => ({
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
        price: variant.price,
        compareAtPrice: variant.compare_at_price ?? undefined,
        stock: variant.stock,
      })),
    },
    images: [...data.product_images]
      .sort((a, b) => a.position - b.position)
      .map((image) => ({
        id: image.id,
        url: productImageUrl(image.storage_path),
        alt: image.alt_text,
      })),
  }
}

function productionActions() {
  return createAdminProductActions({
    repository: createSupabaseProductRepository(),
    requireAdmin: async () => {
      const { requireAdmin } = await import('@/lib/auth/require-admin')
      return requireAdmin()
    },
    onChanged: async (productId) => {
      const { revalidatePath } = await import('next/cache')
      revalidatePath('/admin/products')
      revalidatePath(`/admin/products/${productId}/edit`)
      revalidatePath('/products')
    },
  })
}

export async function createProduct(input: unknown): Promise<ActionResult> {
  'use server'
  return productionActions().createProduct(input)
}

export async function updateProduct(productId: string, input: unknown): Promise<ActionResult> {
  'use server'
  return productionActions().updateProduct(productId, input)
}

export async function setProductPublished(productId: string, published: boolean): Promise<ActionResult> {
  'use server'
  return productionActions().setProductPublished(productId, published)
}

export async function uploadProductImage(productId: string, formData: FormData): Promise<ActionResult> {
  'use server'
  return productionActions().uploadProductImage(productId, {
    alt: formData.get('alt'),
    file: formData.get('file'),
  })
}
