import { z } from 'zod'
import {
  productImageSchema,
  productSchema,
  getProductValidationErrors,
  availableAtError,
  generateProductSlug,
  type ProductVariantErrors,
  type QuantityPriceErrors,
  type ProductInput,
} from '@/lib/validation/product'
import type { Database } from '@/types/database'
import { getMutableE2EProducts } from '@/testing/e2e-storefront-fixtures'
import { getE2EStore } from '@/testing/e2e-store'
import { isE2EMode } from '@/testing/e2e-mode'
import { normalizeProductName } from '@/features/catalog/product-presentation'

type ActionResult = {
  ok: boolean
  message?: string
  productId?: string
  fieldErrors?: Record<string, string[] | undefined>
  variantErrors?: ProductVariantErrors
  quantityPriceErrors?: QuantityPriceErrors
}

export type AdminProductSummary = {
  id: string
  name: string
  slug: string
  category: string
  isPublished: boolean
  totalStock: number
  inventoryCost: number
  imageUrl: string | null
  imageAlt: string
  availableAt: string | null
}

export type AdminProductFilters = {
  query: string
  category: string
  status: '' | 'published' | 'draft'
  stock: '' | 'in_stock' | 'low_stock' | 'sold_out'
}

export function filterAdminProductSummaries<T extends Pick<AdminProductSummary, 'name' | 'category' | 'isPublished' | 'totalStock'>>(
  products: T[],
  filters: AdminProductFilters,
) {
  const query = filters.query.trim().toLocaleLowerCase('zh-Hant')
  return products.filter((product) => (
    (!query || product.name.toLocaleLowerCase('zh-Hant').includes(query))
    && (!filters.category || product.category === filters.category)
    && (!filters.status || (filters.status === 'published' ? product.isPublished : !product.isPublished))
    && (!filters.stock
      || (filters.stock === 'sold_out' && product.totalStock === 0)
      || (filters.stock === 'low_stock' && product.totalStock > 0 && product.totalStock <= 5)
      || (filters.stock === 'in_stock' && product.totalStock > 0))
  ))
}

export type AdminProductDetail = {
  id: string
  isPublished: boolean
  product: ProductInput
  images: Array<{ id: string; url: string; alt: string; color: string | null }>
}

export function listFixtureAdminProducts(): AdminProductSummary[] {
  const store = getE2EStore()
  return getMutableE2EProducts().map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category,
    isPublished: store.publishedProductIds.has(product.id),
    totalStock: product.variants.reduce((total, variant) => total + variant.stock, 0),
    inventoryCost: product.variants.reduce((total, variant) => total + (store.variantCosts.get(variant.id) ?? 0) * variant.stock, 0),
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    availableAt: product.availableAt ?? null,
  }))
}

export interface ProductRepository {
  createProduct(input: ProductInput): Promise<string>
  updateProduct(productId: string, input: ProductInput): Promise<void>
  setPublished(productId: string, published: boolean): Promise<void>
  uploadFile(path: string, file: File): Promise<void>
  copyFile(fromPath: string, toPath: string): Promise<void>
  insertImage(productId: string, path: string, alt: string, color: string | null): Promise<void>
  listImagePaths(productId: string): Promise<Array<{ path: string; alt: string; color: string | null }>>
  setImageColor(productId: string, imageId: string, color: string | null): Promise<void>
  deleteImage(productId: string, imageId: string): Promise<string>
  reorderImages(productId: string, imageIds: string[]): Promise<void>
  removeFile(path: string): Promise<void>
  deleteProduct(productId: string): Promise<void>
}

type AdminProductDependencies = {
  repository: ProductRepository
  /** Reads a product back for duplication; the edit page uses the same loader. */
  loadProduct?: (productId: string) => Promise<AdminProductDetail | null>
  requireAdmin: () => Promise<unknown>
  randomUUID?: () => string
  onChanged?: (productId: string) => void | Promise<void>
  logError?: (message: string, context: { path?: string; productId?: string }) => void
}

const productIdSchema = z.string().uuid()
const imageIdSchema = z.string().min(1)
const imageOrderSchema = z.array(imageIdSchema).min(1).max(30)
  .refine((imageIds) => new Set(imageIds).size === imageIds.length)

function validationFailure(error: z.ZodError): ActionResult {
  const { fieldErrors, variantErrors, quantityPriceErrors } = getProductValidationErrors(error)
  return {
    ok: false,
    message: '請檢查商品資料',
    fieldErrors,
    variantErrors,
    quantityPriceErrors,
  }
}

function databaseErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return ''
}

// Maps known database conflicts to actionable admin-facing messages, and marks
// the offending input so the red hint lands on the exact field rather than
// only in the save bar.
function friendlyProductSaveError(
  error: unknown,
  variants: ProductInput['variants'],
): ActionResult | null {
  const message = databaseErrorMessage(error)
  const details = error && typeof error === 'object' && 'details' in error
    ? String((error as { details: unknown }).details ?? '')
    : ''

  if (message.includes('product_variants_sku_lower_key')) {
    const conflictingSku = details.match(/=\((.+?)\)/)?.[1]?.trim().toLowerCase()
    const fieldMessage = conflictingSku
      ? `SKU「${conflictingSku}」已被其他商品使用，請改用不同編號`
      : 'SKU 已被其他商品使用，請改用不同編號'
    const variantErrors: ProductVariantErrors = []
    variants.forEach((variant, index) => {
      if (!conflictingSku || variant.sku.trim().toLowerCase() === conflictingSku) {
        variantErrors[index] = { sku: [fieldMessage] }
      }
    })
    return {
      ok: false,
      message: `${fieldMessage}（SKU 全店不可重複，建議加上商品代號，例如 WF01-100）`,
      variantErrors,
    }
  }

  if (message.includes('products_slug_key')) {
    const fieldMessage = '網址代稱已被其他商品使用，請更換'
    return { ok: false, message: `${fieldMessage}（留空會自動產生）`, fieldErrors: { slug: [fieldMessage] } }
  }

  if (message.includes('product_series_category_mismatch')) {
    const fieldMessage = '所選系列與商品分類不符，請重新選擇'
    return { ok: false, message: fieldMessage, fieldErrors: { seriesIds: [fieldMessage] } }
  }

  return null
}

function withAutomaticProductSeo(product: ProductInput): ProductInput {
  const normalizedName = normalizeProductName(product.name)
  const titleSuffix = '｜MORIMUR BABY'
  const titleName = normalizedName.slice(0, 70 - titleSuffix.length).trimEnd()
  const description = (product.summary?.trim() || product.description.trim() || normalizedName)
    .replace(/\s+/g, ' ')
    .slice(0, 160)

  return {
    ...product,
    name: normalizedName,
    seoTitle: `${titleName}${titleSuffix}`,
    seoDescription: description,
  }
}

/**
 * Turns a saved product into the input for its copy: same content, new identity.
 * The copy always starts as a draft with no scheduled launch, so duplicating can
 * never put an unchecked product in front of shoppers.
 */
export function buildDuplicateProductInput(source: ProductInput, uniqueToken: string): ProductInput {
  const name = `${source.name}（複本）`
  return {
    ...source,
    name,
    slug: generateProductSlug(source.name, uniqueToken),
    seoTitle: '',
    seoDescription: '',
    isNew: false,
    availableAt: null,
    // Variant ids belong to the original rows; SKUs must stay unique per store.
    variants: source.variants.map((variant) => ({
      ...variant,
      id: undefined,
      updatedAt: undefined,
      sku: `${variant.sku}-COPY`.slice(0, 64),
    })),
    quantityPrices: source.quantityPrices.map((tier) => ({ ...tier })),
    seriesIds: [...source.seriesIds],
    ageBands: [...source.ageBands],
    tags: [...(source.tags ?? [])],
  }
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
      const scheduleError = availableAtError(parsed.data.availableAt, null)
      if (scheduleError) {
        return { ok: false, message: scheduleError, fieldErrors: { availableAt: [scheduleError] } }
      }
      if (parsed.data.variants.some((variant) => variant.id)) {
        return { ok: false, message: '新商品不可包含既有商品規格編號' }
      }
      // Auto-generate the URL slug when the admin leaves it blank, so adding
      // many products doesn't require inventing a slug each time.
      const data = withAutomaticProductSeo(parsed.data.slug
        ? parsed.data
        : { ...parsed.data, slug: generateProductSlug(parsed.data.name, randomUUID()) })

      let productId: string
      try {
        productId = await dependencies.repository.createProduct(data)
      } catch (error) {
        const friendly = friendlyProductSaveError(error, data.variants)
        if (friendly) return friendly
        logError(`product create failed: ${databaseErrorMessage(error)}`, {})
        return { ok: false, message: '目前無法建立商品，請稍後再試' }
      }
      await refreshAfterMutation(productId)
      return { ok: true, productId }
    },

    // Copies a saved product into a fresh draft — content, variants, tiers and
    // photos — so a new colourway costs one click instead of a full re-entry.
    async duplicateProduct(productId: string): Promise<ActionResult> {
      await dependencies.requireAdmin()
      const id = productIdSchema.safeParse(productId)
      if (!id.success) return { ok: false, message: '商品不存在' }
      const source = await dependencies.loadProduct?.(id.data)
      if (!source) return { ok: false, message: '商品不存在' }

      const input = buildDuplicateProductInput(source.product, randomUUID())
      const parsed = productSchema.safeParse(input)
      if (!parsed.success) return { ok: false, message: '這個商品的資料無法複製，請改用手動新增' }

      let copyId: string
      try {
        copyId = await dependencies.repository.createProduct(withAutomaticProductSeo(parsed.data))
      } catch (error) {
        const friendly = friendlyProductSaveError(error, parsed.data.variants)
        if (friendly) return friendly
        logError(`product duplicate failed: ${databaseErrorMessage(error)}`, { productId: id.data })
        return { ok: false, message: '目前無法複製商品，請稍後再試' }
      }

      // Photos are copied best-effort: a copy that lost an image is still worth
      // far more to the admin than no copy at all.
      let copiedImages = 0
      try {
        const images = await dependencies.repository.listImagePaths(id.data)
        for (const image of images) {
          const extension = image.path.split('.').pop() || 'png'
          const target = `${copyId}/${randomUUID()}.${extension}`
          await dependencies.repository.copyFile(image.path, target)
          await dependencies.repository.insertImage(copyId, target, image.alt, image.color)
          copiedImages += 1
        }
      } catch (error) {
        logError(`product duplicate images failed: ${databaseErrorMessage(error)}`, { productId: copyId })
      }

      await refreshAfterMutation(copyId)
      return {
        ok: true,
        productId: copyId,
        message: copiedImages > 0
          ? '已複製為草稿，請確認內容後再上架'
          : '已複製為草稿（圖片未複製），請確認內容後再上架',
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
      if (!parsed.data.slug) {
        return { ok: false, message: '網址代稱不可為空', fieldErrors: { slug: ['網址代稱不可為空'] } }
      }

      try {
        await dependencies.repository.updateProduct(id.data, withAutomaticProductSeo(parsed.data))
      } catch (error) {
        const message = databaseErrorMessage(error)
        if (message.includes('variant_not_owned')) {
          return { ok: false, message: '商品規格不存在或不屬於此商品' }
        }
        if (message.includes('stale_product_variant')) {
          return { ok: false, message: '商品庫存或規格已更新，請重新載入後再儲存' }
        }
        const friendly = friendlyProductSaveError(error, parsed.data.variants)
        if (friendly) return friendly
        logError(`product update failed: ${message}`, { productId: id.data })
        return { ok: false, message: '目前無法更新商品，請稍後再試' }
      }
      await refreshAfterMutation(id.data)
      return { ok: true, productId: id.data, message: '商品修改已儲存' }
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

    // Reuses an image already stored for a draft: copies it into the product's
    // folder server-side, so draft images never round-trip through the browser
    // (which would hit the server-action body limit for phone-sized photos).
    async adoptDraftImage(productId: string, storagePath: string, alt: string, color: string | null = null): Promise<ActionResult> {
      await dependencies.requireAdmin()
      const id = productIdSchema.safeParse(productId)
      if (!id.success) return { ok: false, message: '商品不存在' }
      if (!storagePath.startsWith('drafts/')) return { ok: false, message: '草稿圖片路徑無效' }

      const extension = storagePath.split('.').pop() || 'png'
      const target = `${id.data}/${randomUUID()}.${extension}`
      try {
        await dependencies.repository.copyFile(storagePath, target)
      } catch {
        return { ok: false, message: '目前無法沿用草稿圖片，請重新選擇圖片' }
      }
      try {
        await dependencies.repository.insertImage(id.data, target, alt, color)
      } catch {
        try { await dependencies.repository.removeFile(target) } catch { /* ignore */ }
        return { ok: false, message: '圖片資料儲存失敗，請稍後再試' }
      }
      return { ok: true, productId: id.data }
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
        await dependencies.repository.insertImage(id.data, path, parsed.data.alt, parsed.data.color)
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

    async updateProductImageColor(productId: string, imageId: string, color: string | null): Promise<ActionResult> {
      await dependencies.requireAdmin()
      const id = productIdSchema.safeParse(productId)
      const parsedImageId = imageIdSchema.safeParse(imageId)
      if (!id.success || !parsedImageId.success) return { ok: false, message: '商品圖片不存在' }

      try {
        await dependencies.repository.setImageColor(id.data, parsedImageId.data, color?.trim() || null)
      } catch (error) {
        if (databaseErrorMessage(error).includes('product_image_color_invalid')) {
          return { ok: false, message: '這個顏色已不在商品規格中，請重新選擇' }
        }
        return { ok: false, message: '目前無法更新圖片顏色，請稍後再試' }
      }
      await refreshAfterMutation(id.data)
      return { ok: true, productId: id.data, message: '圖片顏色已更新' }
    },

    async deleteProductImage(productId: string, imageId: string): Promise<ActionResult> {
      await dependencies.requireAdmin()
      const id = productIdSchema.safeParse(productId)
      const parsedImageId = imageIdSchema.safeParse(imageId)
      if (!id.success || !parsedImageId.success) return { ok: false, message: '商品圖片不存在' }

      let path: string
      try {
        path = await dependencies.repository.deleteImage(id.data, parsedImageId.data)
      } catch {
        return { ok: false, message: '目前無法刪除商品圖片，請稍後再試' }
      }
      if (path) {
        try {
          await dependencies.repository.removeFile(path)
        } catch {
          logError('product image storage cleanup failed', { path, productId: id.data })
        }
      }
      await refreshAfterMutation(id.data)
      return { ok: true, productId: id.data, message: '商品圖片已刪除' }
    },

    async reorderProductImages(productId: string, imageIds: string[]): Promise<ActionResult> {
      await dependencies.requireAdmin()
      const id = productIdSchema.safeParse(productId)
      const parsedImageIds = imageOrderSchema.safeParse(imageIds)
      if (!id.success || !parsedImageIds.success) return { ok: false, message: '商品圖片順序無效' }

      try {
        await dependencies.repository.reorderImages(id.data, parsedImageIds.data)
      } catch {
        return { ok: false, message: '目前無法調整圖片順序，請稍後再試' }
      }
      await refreshAfterMutation(id.data)
      return { ok: true, productId: id.data, message: '商品圖片順序已更新' }
    },

    async deleteProduct(productId: string): Promise<ActionResult> {
      await dependencies.requireAdmin()
      const id = productIdSchema.safeParse(productId)
      if (!id.success) return { ok: false, message: '商品不存在' }
      try {
        await dependencies.repository.deleteProduct(id.data)
      } catch (error) {
        const message = databaseErrorMessage(error)
        if (message.includes('foreign key') || message.includes('violates')) {
          return { ok: false, message: '商品已有訂單紀錄，請改為下架保留資料' }
        }
        return { ok: false, message: '目前無法刪除商品，請稍後再試' }
      }
      await refreshAfterMutation(id.data)
      return { ok: true, productId: id.data, message: '商品已刪除' }
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

    async copyFile(fromPath, toPath) {
      const supabase = await client()
      const { error } = await supabase.storage.from('product-images').copy(fromPath, toPath)
      if (error) throw error
    },

    async insertImage(productId, path, alt, color) {
      const supabase = await client()
      const { error } = await supabase.rpc('admin_insert_product_image', {
        p_product_id: productId,
        p_storage_path: path,
        p_alt_text: alt,
        p_color: color,
      })
      if (error) throw error
    },

    async listImagePaths(productId) {
      const supabase = await client()
      const { data, error } = await supabase
        .from('product_images')
        .select('storage_path, alt_text, color, position')
        .eq('product_id', productId)
        .order('position')
      if (error) throw error
      return (data ?? []).map((image) => ({
        path: image.storage_path,
        alt: image.alt_text,
        color: image.color,
      }))
    },

    async setImageColor(productId, imageId, color) {
      const supabase = await client()
      const { error } = await supabase.rpc('admin_set_product_image_color', {
        p_product_id: productId,
        p_image_id: imageId,
        p_color: color,
      })
      if (error) throw error
    },

    async deleteImage(productId, imageId) {
      const supabase = await client()
      const { data, error: selectError } = await supabase
        .from('product_images')
        .select('storage_path')
        .eq('id', imageId)
        .eq('product_id', productId)
        .maybeSingle()
      if (selectError) throw selectError
      if (!data) throw new Error('image_not_found')
      const { error: deleteError } = await supabase
        .from('product_images')
        .delete()
        .eq('id', imageId)
        .eq('product_id', productId)
      if (deleteError) throw deleteError
      return data.storage_path
    },

    async reorderImages(productId, imageIds) {
      const supabase = await client()
      const { error } = await supabase.rpc('admin_reorder_product_images', {
        p_product_id: productId,
        p_image_ids: imageIds,
      })
      if (error) throw error
    },

    async removeFile(path) {
      const supabase = await client()
      const { error } = await supabase.storage.from('product-images').remove([path])
      if (error) throw error
    },
    async deleteProduct(productId) {
      const supabase = await client()
      const { data: images, error: imageError } = await supabase
        .from('product_images')
        .select('storage_path')
        .eq('product_id', productId)
      if (imageError) throw imageError
      const { error } = await supabase.from('products').delete().eq('id', productId)
      if (error) throw error
      const paths = (images ?? []).map((image) => image.storage_path)
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage.from('product-images').remove(paths)
        if (storageError) throw storageError
      }
    },
  }
}

function createFixtureProductRepository(): ProductRepository {
  function validateSeries(input: ProductInput) {
    const store = getE2EStore()
    const valid = input.seriesIds.every((seriesId) => store.productSeries.some((series) => (
      series.id === seriesId && series.categoryName === input.category
    )))
    if (!valid) throw new Error('product_series_category_mismatch')
  }

  function replaceSeriesAssignments(productId: string, seriesIds: string[]) {
    const store = getE2EStore()
    store.productSeriesProducts = [
      ...store.productSeriesProducts.filter((assignment) => assignment.productId !== productId),
      ...[...new Set(seriesIds)].map((seriesId) => ({ productId, seriesId })),
    ]
  }

  function replaceQuantityPrices(slug: string, input: ProductInput) {
    const store = getE2EStore()
    if (input.quantityPrices.length) store.quantityPrices.set(slug, [...input.quantityPrices])
    else store.quantityPrices.delete(slug)
  }

  return {
    async createProduct(input) {
      validateSeries(input)
      const id = crypto.randomUUID()
      const variants = input.variants.map((variant) => {
        const variantId = crypto.randomUUID()
        getE2EStore().variantCosts.set(variantId, variant.cost ?? 0)
        return {
          id: variantId,
          sku: variant.sku,
          color: variant.color,
          size: variant.size,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice ?? null,
          stock: variant.stock,
        }
      })
      getMutableE2EProducts().unshift({
        id,
        slug: input.slug,
        name: input.name,
        description: input.description,
        summary: input.summary ?? '',
        tags: input.tags ?? [],
        seoTitle: input.seoTitle ?? '',
        seoDescription: input.seoDescription ?? '',
        category: input.category,
        series: [],
        ageBands: input.ageBands,
        material: input.material,
        careInstructions: input.careInstructions,
        sizeGuide: input.sizeGuide,
        isNew: input.isNew,
        availableAt: input.availableAt ?? null,
        imageUrl: null,
        imageAlt: input.name,
        variants,
      })
      replaceSeriesAssignments(id, input.seriesIds)
      replaceQuantityPrices(input.slug, input)
      return id
    },
    async updateProduct(productId, input) {
      validateSeries(input)
      const products = getMutableE2EProducts()
      const index = products.findIndex((product) => product.id === productId)
      if (index < 0) throw new Error('product_not_found')
      const existing = products[index]
      const existingVariantIds = new Set(existing.variants.map((variant) => variant.id))
      if (input.variants.some((variant) => variant.id && !existingVariantIds.has(variant.id))) {
        throw new Error('variant_not_owned')
      }
      const retainedVariantIds = new Set(input.variants.flatMap((variant) => (variant.id ? [variant.id] : [])))
      for (const variant of existing.variants) {
        if (!retainedVariantIds.has(variant.id)) getE2EStore().variantCosts.delete(variant.id)
      }
      products[index] = {
        ...existing,
        slug: input.slug,
        name: input.name,
        description: input.description,
        summary: input.summary ?? '',
        tags: input.tags ?? [],
        seoTitle: input.seoTitle ?? '',
        seoDescription: input.seoDescription ?? '',
        category: input.category,
        ageBands: input.ageBands,
        material: input.material,
        careInstructions: input.careInstructions,
        sizeGuide: input.sizeGuide,
        isNew: input.isNew,
        availableAt: input.availableAt ?? null,
        variants: input.variants.map((variant) => {
          const variantId = variant.id ?? crypto.randomUUID()
          getE2EStore().variantCosts.set(variantId, variant.cost ?? 0)
          return {
            id: variantId,
            sku: variant.sku,
            color: variant.color,
            size: variant.size,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice ?? null,
            stock: variant.stock,
          }
        }),
      }
      replaceSeriesAssignments(productId, input.seriesIds)
      replaceQuantityPrices(products[index].slug, input)
    },
    async setPublished(productId, published) {
      const product = getMutableE2EProducts().find((candidate) => candidate.id === productId)
      if (!product) throw new Error('product_not_found')
      if (published && !product.imageUrl) throw new Error('product_image_required')
      if (published && !product.variants.some((variant) => variant.stock > 0)) {
        throw new Error('in_stock_variant_required')
      }
      const publishedIds = getE2EStore().publishedProductIds
      if (published) publishedIds.add(productId)
      else publishedIds.delete(productId)
    },
    async uploadFile(path, file) {
      const bytes = Buffer.from(await file.arrayBuffer()).toString('base64')
      getE2EStore().uploadedProductImages.set(path, `data:${file.type};base64,${bytes}`)
    },
    async copyFile(fromPath, toPath) {
      const store = getE2EStore()
      const existing = store.uploadedProductImages.get(fromPath)
      // Seeded fixture photos are plain URLs or /public paths rather than
      // uploads; keep them as-is so a duplicated product still shows a picture.
      const fallback = /^(https?:|data:|\/)/.test(fromPath) ? fromPath : `data:image/png;base64,${fromPath}`
      store.uploadedProductImages.set(toPath, existing ?? fallback)
    },
    async listImagePaths(productId) {
      const store = getE2EStore()
      const product = getMutableE2EProducts().find((candidate) => candidate.id === productId)
      if (!product) throw new Error('product_not_found')
      const images = product.images ?? (product.imageUrl ? [{ url: product.imageUrl, alt: product.imageAlt, color: null }] : [])
      return images.map((image) => ({
        path: [...store.uploadedProductImages.entries()].find(([, url]) => url === image.url)?.[0] ?? image.url,
        alt: image.alt,
        color: image.color ?? null,
      }))
    },
    async insertImage(productId, path, alt, color) {
      const product = getMutableE2EProducts().find((candidate) => candidate.id === productId)
      const imageUrl = getE2EStore().uploadedProductImages.get(path)
      if (!product || !imageUrl) throw new Error('image_not_found')
      product.images = [...(product.images ?? (product.imageUrl ? [{ url: product.imageUrl, alt: product.imageAlt, color: null }] : [])), { url: imageUrl, alt, color }]
      if (!product.imageUrl) {
        product.imageUrl = imageUrl
        product.imageAlt = alt
      }
    },
    async setImageColor(productId, imageId, color) {
      const product = getMutableE2EProducts().find((candidate) => candidate.id === productId)
      if (!product) throw new Error('product_not_found')
      if (color !== null && !product.variants.some((variant) => variant.color === color)) {
        throw new Error('product_image_color_invalid')
      }
      const images = [...(product.images ?? (product.imageUrl ? [{ url: product.imageUrl, alt: product.imageAlt, color: null }] : []))]
      const indexText = imageId.startsWith(`${productId}-`) ? imageId.slice(productId.length + 1) : ''
      const index = Number(indexText)
      if (!Number.isInteger(index) || index < 0 || index >= images.length) throw new Error('image_not_found')
      images[index] = { ...images[index], color }
      product.images = images
    },
    async deleteImage(productId, imageId) {
      const product = getMutableE2EProducts().find((candidate) => candidate.id === productId)
      if (!product) throw new Error('product_not_found')
      const images = [...(product.images ?? (product.imageUrl ? [{ url: product.imageUrl, alt: product.imageAlt, color: null }] : []))]
      const indexText = imageId.startsWith(`${productId}-`) ? imageId.slice(productId.length + 1) : ''
      const index = Number(indexText)
      if (!Number.isInteger(index) || index < 0 || index >= images.length) throw new Error('image_not_found')
      const [removed] = images.splice(index, 1)
      product.images = images
      product.imageUrl = images[0]?.url ?? null
      product.imageAlt = images[0]?.alt ?? product.name
      return [...getE2EStore().uploadedProductImages.entries()].find(([, url]) => url === removed.url)?.[0] ?? ''
    },
    async reorderImages(productId, imageIds) {
      const product = getMutableE2EProducts().find((candidate) => candidate.id === productId)
      if (!product) throw new Error('product_not_found')
      const images = [...(product.images ?? (product.imageUrl ? [{ url: product.imageUrl, alt: product.imageAlt, color: null }] : []))]
      const reordered = imageIds.map((imageId) => {
        const indexText = imageId.startsWith(`${productId}-`) ? imageId.slice(productId.length + 1) : ''
        const index = Number(indexText)
        if (!Number.isInteger(index) || index < 0 || index >= images.length) throw new Error('image_not_found')
        return images[index]
      })
      if (reordered.length !== images.length || new Set(reordered).size !== images.length) throw new Error('image_order_invalid')
      product.images = reordered
      product.imageUrl = reordered[0]?.url ?? null
      product.imageAlt = reordered[0]?.alt ?? product.name
    },
    async removeFile(path) {
      getE2EStore().uploadedProductImages.delete(path)
    },
    async deleteProduct(productId) {
      const products = getMutableE2EProducts()
      const index = products.findIndex((product) => product.id === productId)
      if (index < 0) throw new Error('product_not_found')
      for (const variant of products[index].variants) getE2EStore().variantCosts.delete(variant.id)
      products.splice(index, 1)
      getE2EStore().productSeriesProducts = getE2EStore().productSeriesProducts
        .filter((assignment) => assignment.productId !== productId)
      getE2EStore().publishedProductIds.delete(productId)
      for (const path of getE2EStore().uploadedProductImages.keys()) {
        if (path.startsWith(`${productId}/`)) getE2EStore().uploadedProductImages.delete(path)
      }
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
  if (isE2EMode()) return listFixtureAdminProducts()
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { data, error } = await createAdminClient()
    .from('products')
    .select(`
      id, name, slug, category, is_published, available_at,
      product_images(storage_path, alt_text, position),
      product_variants(stock, cost)
    `)
    .eq('product_variants.is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((record) => {
    const image = [...record.product_images].sort((a, b) => a.position - b.position)[0]
    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      category: record.category,
      isPublished: record.is_published,
      totalStock: record.product_variants.reduce((total, variant) => total + variant.stock, 0),
      inventoryCost: record.product_variants.reduce((total, variant) => total + variant.cost * variant.stock, 0),
      imageUrl: image ? productImageUrl(image.storage_path) : null,
      imageAlt: image?.alt_text ?? record.name,
      availableAt: record.available_at,
    }
  })
}

export async function getAdminProduct(productId: string): Promise<AdminProductDetail | null> {
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()
  const id = productIdSchema.safeParse(productId)
  if (!id.success) return null

  if (isE2EMode()) {
    const product = getMutableE2EProducts().find((candidate) => candidate.id === id.data)
    if (!product) return null
    return {
      id: product.id,
      isPublished: getE2EStore().publishedProductIds.has(product.id),
      product: {
        name: product.name,
        slug: product.slug,
        category: product.category,
        seriesIds: getE2EStore().productSeriesProducts
          .filter((assignment) => assignment.productId === product.id)
          .map((assignment) => assignment.seriesId),
        quantityPrices: [...(getE2EStore().quantityPrices.get(product.slug) ?? [])],
        ageBands: [...product.ageBands],
        description: product.description,
        summary: product.summary ?? '',
        tags: [...(product.tags ?? [])],
        seoTitle: product.seoTitle ?? '',
        seoDescription: product.seoDescription ?? '',
        material: product.material,
        careInstructions: product.careInstructions,
        sizeGuide: product.sizeGuide,
        isNew: product.isNew,
        availableAt: product.availableAt ?? null,
        variants: product.variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          color: variant.color,
          size: variant.size,
          price: variant.price,
          cost: getE2EStore().variantCosts.get(variant.id) ?? 0,
          compareAtPrice: variant.compareAtPrice ?? undefined,
          stock: variant.stock,
          updatedAt: '2026-07-20T00:00:00.000Z',
        })),
      },
      images: (product.images ?? (product.imageUrl ? [{ url: product.imageUrl, alt: product.imageAlt, color: null }] : []))
        .map((image, index) => ({ id: `${product.id}-${index}`, ...image })),
    }
  }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { data, error } = await createAdminClient()
    .from('products')
    .select(`
      id, name, slug, category, age_bands, description,
      summary, tags, seo_title, seo_description, material,
      care_instructions, size_guide, is_new, is_published, available_at,
      product_series_products(series_id),
      product_images(id, storage_path, alt_text, position, color),
      product_variants(id, sku, color, size, price, cost, compare_at_price, stock, updated_at)
    `)
    .eq('id', id.data)
    .eq('product_variants.is_active', true)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  // Read separately and tolerate failure so the edit page still loads if the
  // quantity-pricing migration has not been applied yet.
  let quantityPrices: Array<{ quantity: number; bundlePrice: number }> = []
  try {
    const { data: tierRows, error: tierError } = await createAdminClient()
      .from('product_quantity_prices')
      .select('quantity, bundle_price')
      .eq('product_id', id.data)
      .order('quantity')
    if (tierError) throw tierError
    quantityPrices = (tierRows ?? []).map((tier) => ({
      quantity: tier.quantity,
      bundlePrice: tier.bundle_price,
    }))
  } catch {
    quantityPrices = []
  }

  return {
    id: data.id,
    isPublished: data.is_published,
    product: {
      name: data.name,
      slug: data.slug,
      category: data.category,
      seriesIds: data.product_series_products.map((assignment) => assignment.series_id),
      quantityPrices,
      ageBands: data.age_bands,
      description: data.description,
      summary: data.summary ?? '',
      tags: data.tags ?? [],
      seoTitle: data.seo_title ?? '',
      seoDescription: data.seo_description ?? '',
      material: data.material,
      careInstructions: data.care_instructions,
      sizeGuide: data.size_guide,
      isNew: data.is_new,
      availableAt: data.available_at,
      variants: data.product_variants.map((variant) => ({
        id: variant.id,
        updatedAt: variant.updated_at,
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
        price: variant.price,
        cost: variant.cost,
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
        color: image.color,
      })),
  }
}

function productionActions() {
  return createAdminProductActions({
    repository: createSupabaseProductRepository(),
    loadProduct: (productId) => getAdminProduct(productId),
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

function fixtureActions() {
  return createAdminProductActions({
    repository: createFixtureProductRepository(),
    loadProduct: (productId) => getAdminProduct(productId),
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

function resolvedActions() {
  return isE2EMode() ? fixtureActions() : productionActions()
}

export async function createProduct(input: unknown): Promise<ActionResult> {
  'use server'
  return resolvedActions().createProduct(input)
}

export async function createProductWithImage(input: unknown, formData?: FormData): Promise<ActionResult> {
  'use server'
  const files = (formData?.getAll('file') ?? []).filter((entry): entry is File => entry instanceof File && entry.size > 0)
  // Draft images already live in storage; they arrive as paths, not files.
  let draftPaths: string[] = []
  let imageColors: Array<string | null> = []
  try {
    const parsed = JSON.parse(String(formData?.get('draftImagePaths') ?? '[]')) as unknown
    if (Array.isArray(parsed)) draftPaths = parsed.filter((path): path is string => typeof path === 'string')
  } catch { /* ignore */ }
  try {
    const parsed = JSON.parse(String(formData?.get('imageColors') ?? '[]')) as unknown
    if (Array.isArray(parsed)) {
      imageColors = parsed.map((color) => typeof color === 'string' && color.trim() ? color.trim() : null)
    }
  } catch { /* ignore */ }

  if (!formData || (files.length === 0 && draftPaths.length === 0)) {
    return { ok: false, message: '請選擇至少一張商品圖片' }
  }
  const actions = resolvedActions()
  const created = await actions.createProduct(input)
  if (!created.ok || !created.productId) return created

  const alt = String(formData.get('alt') ?? '')
  const altFor = (index: number) => (index === 0 ? alt : `${alt}（第 ${index + 1} 張）`)
  const colorFor = (index: number) => imageColors[index] ?? null

  for (const [index, file] of files.entries()) {
    const uploaded = await actions.uploadProductImage(created.productId, {
      alt: altFor(index),
      color: colorFor(index),
      file,
    })
    if (!uploaded.ok) {
      await actions.deleteProduct(created.productId)
      return uploaded
    }
  }
  for (const [index, path] of draftPaths.entries()) {
    const imageIndex = files.length + index
    const adopted = await actions.adoptDraftImage(
      created.productId,
      path,
      altFor(imageIndex),
      colorFor(imageIndex),
    )
    if (!adopted.ok) {
      await actions.deleteProduct(created.productId)
      return adopted
    }
  }
  const total = files.length + draftPaths.length
  return { ok: true, productId: created.productId, message: `商品與 ${total} 張圖片已建立` }
}

export async function duplicateProduct(productId: string): Promise<ActionResult> {
  'use server'
  return resolvedActions().duplicateProduct(productId)
}

export async function updateProduct(productId: string, input: unknown): Promise<ActionResult> {
  'use server'
  return resolvedActions().updateProduct(productId, input)
}

export async function setProductPublished(productId: string, published: boolean): Promise<ActionResult> {
  'use server'
  return resolvedActions().setProductPublished(productId, published)
}

export async function uploadProductImage(productId: string, formData: FormData): Promise<ActionResult> {
  'use server'
  return resolvedActions().uploadProductImage(productId, {
    alt: formData.get('alt'),
    color: String(formData.get('color') ?? '').trim() || null,
    file: formData.get('file'),
  })
}

export async function updateProductImageColor(
  productId: string,
  imageId: string,
  color: string | null,
): Promise<ActionResult> {
  'use server'
  return resolvedActions().updateProductImageColor(productId, imageId, color)
}

export async function deleteProductImage(productId: string, imageId: string): Promise<ActionResult> {
  'use server'
  return resolvedActions().deleteProductImage(productId, imageId)
}

export async function reorderProductImages(productId: string, imageIds: string[]): Promise<ActionResult> {
  'use server'
  return resolvedActions().reorderProductImages(productId, imageIds)
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  'use server'
  return resolvedActions().deleteProduct(productId)
}
