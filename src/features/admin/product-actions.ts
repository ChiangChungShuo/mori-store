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

export interface ProductRepository {
  createProduct(input: ProductInput): Promise<string>
  updateProduct(productId: string, input: ProductInput): Promise<void>
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
  logError?: (message: string, context: { path?: string; productId?: string }) => void
}

const productIdSchema = z.string().uuid()

function validationFailure(error: z.ZodError): ActionResult {
  return {
    ok: false,
    message: '請檢查商品資料',
    fieldErrors: error.flatten().fieldErrors,
  }
}

function databaseErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return ''
}

export function createAdminProductActions(dependencies: AdminProductDependencies) {
  const randomUUID = dependencies.randomUUID ?? (() => crypto.randomUUID())
  const changed = dependencies.onChanged ?? (() => undefined)
  const logError = dependencies.logError ?? ((message, context) => console.error(message, context))

  async function refreshAfterMutation(productId: string) {
    try {
      await changed(productId)
    } catch {
      logError('product admin cache refresh failed', { productId })
    }
  }

  return {
    async createProduct(input: unknown): Promise<ActionResult> {
      await dependencies.requireAdmin()
      const parsed = productSchema.safeParse(input)
      if (!parsed.success) return validationFailure(parsed.error)
      if (parsed.data.variants.some((variant) => variant.id)) {
        return { ok: false, message: '新商品不可包含既有商品規格編號' }
      }

      let productId: string
      try {
        productId = await dependencies.repository.createProduct(parsed.data)
      } catch {
        return { ok: false, message: '目前無法建立商品，請稍後再試' }
      }
      await refreshAfterMutation(productId)
      return { ok: true, productId }
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
      } catch (error) {
        const message = databaseErrorMessage(error)
        if (message.includes('variant_not_owned')) {
          return { ok: false, message: '商品規格不存在或不屬於此商品' }
        }
        if (message.includes('stale_product_variant')) {
          return { ok: false, message: '商品庫存或規格已更新，請重新載入後再儲存' }
        }
        return { ok: false, message: '目前無法更新商品，請稍後再試' }
      }
      await refreshAfterMutation(id.data)
      return { ok: true, productId: id.data }
    },

    async setProductPublished(productId: string, published: boolean): Promise<ActionResult> {
      await dependencies.requireAdmin()
      const id = productIdSchema.safeParse(productId)
      if (!id.success) return { ok: false, message: '商品不存在' }

      try {
        await dependencies.repository.setPublished(id.data, published)
      } catch (error) {
        const message = databaseErrorMessage(error)
        if (message.includes('product_image_required')) {
          return { ok: false, message: '商品至少需要一張圖片才能上架' }
        }
        if (message.includes('in_stock_variant_required')) {
          return { ok: false, message: '商品至少需要一個有庫存的規格才能上架' }
        }
        return { ok: false, message: '目前無法變更上架狀態，請稍後再試' }
      }
      await refreshAfterMutation(id.data)
      return {
        ok: true,
        productId: id.data,
        message: published ? '商品已上架' : '商品已下架',
      }
    },

    async uploadProductImage(productId: string, input: unknown): Promise<ActionResult> {
      await dependencies.requireAdmin()
      const id = productIdSchema.safeParse(productId)
      const parsed = await productImageSchema.safeParseAsync(input)
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
          logError('product image cleanup failed', { path })
          return { ok: false, message: '圖片資料儲存失敗，且暫時無法清理上傳檔案' }
        }
        return { ok: false, message: '目前無法儲存圖片資料，請稍後再試' }
      }

      await refreshAfterMutation(id.data)
      return { ok: true, productId: id.data }
    },
  }
}

function createSupabaseProductRepository(): ProductRepository {
  async function client() {
    const { createClient } = await import('@/lib/supabase/server')
    return createClient()
  }

  return {
    async createProduct(input) {
      const supabase = await client()
      const { data, error } = await supabase.rpc('admin_create_product', {
        p_product: input as unknown as Database['public']['Functions']['admin_create_product']['Args']['p_product'],
        p_variants: input.variants as unknown as Database['public']['Functions']['admin_create_product']['Args']['p_variants'],
      })
      if (error) throw error
      return data
    },

    async updateProduct(productId, input) {
      const supabase = await client()
      const { error } = await supabase.rpc('admin_update_product', {
        p_product_id: productId,
        p_product: input as unknown as Database['public']['Functions']['admin_update_product']['Args']['p_product'],
        p_variants: input.variants as unknown as Database['public']['Functions']['admin_update_product']['Args']['p_variants'],
      })
      if (error) throw error
    },

    async setPublished(productId, published) {
      const supabase = await client()
      const { error } = await supabase.rpc('admin_set_product_published', {
        p_product_id: productId,
        p_published: published,
      })
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
      const { error } = await supabase.rpc('admin_insert_product_image', {
        p_product_id: productId,
        p_storage_path: path,
        p_alt_text: alt,
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
    .eq('product_variants.is_active', true)
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
      product_variants(id, sku, color, size, price, compare_at_price, stock, updated_at)
    `)
    .eq('id', id.data)
    .eq('product_variants.is_active', true)
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
        id: variant.id,
        updatedAt: variant.updated_at,
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
