import { createElement, useState } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  createAdminProductActions,
  filterAdminProductSummaries,
  type ProductRepository,
} from '@/features/admin/product-actions'
import type { ProductInput } from '@/lib/validation/product'
import { ImageUploader } from '@/features/admin/image-uploader'
import { ProductForm, ProductPublishForm } from '@/features/admin/product-form'
import { Toaster } from '@/components/toast'
import { VariantGrid } from '@/features/admin/variant-grid'
import type { ProductSeries } from '@/features/catalog/product-series'

const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const variantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const foreignVariantId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const initialVariantVersion = '2026-07-17T10:00:00.000Z'

const product: ProductInput = {
  name: '彩色口袋 Tee',
  slug: 'color-pocket-tee',
  category: 'tops',
  seriesIds: [],
  ageBands: ['3-6'],
  description: '柔軟日常上衣',
  material: '100% 棉',
  careInstructions: '冷水洗滌',
  sizeGuide: '正常版型',
  isNew: true,
  quantityPrices: [],
  variants: [
    {
      id: variantId,
      updatedAt: initialVariantVersion,
      sku: 'TEE-Y-100',
      color: '黃色',
      size: '100',
      price: 590,
      cost: 260,
      stock: 3,
    },
  ],
}

const newProduct: ProductInput = {
  ...product,
  variants: product.variants.map((variant) => ({
    sku: variant.sku,
    color: variant.color,
    size: variant.size,
    price: variant.price,
    cost: variant.cost,
    compareAtPrice: variant.compareAtPrice,
    stock: variant.stock,
  })),
}

function imageFile(type: 'image/png' | 'image/webp') {
  const bytes = type === 'image/png'
    ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    : [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]
  return new File([new Uint8Array(bytes)], 'shirt', { type })
}

class MemoryProductRepository implements ProductRepository {
  readonly events: string[] = []
  readonly uploadedPaths: string[] = []
  readonly removedPaths: string[] = []
  savedProduct: ProductInput | null = null
  published = false
  imageCount = 0
  inStockVariantCount = 1
  failImageInsert = false
  failImageRemove = false
  failImageColor = false
  variantBelongsToProduct = true

  async createProduct(input: ProductInput) {
    this.events.push('create')
    this.savedProduct = input
    return productId
  }

  async updateProduct(id: string, input: ProductInput) {
    this.events.push(`update:${id}`)
    if (!this.variantBelongsToProduct && input.variants.some((variant) => variant.id)) {
      throw new Error('variant_not_owned')
    }
    this.savedProduct = input
  }

  async setPublished(id: string, published: boolean) {
    this.events.push(`publish:${id}:${published}`)
    if (published && this.imageCount < 1) throw new Error('product_image_required')
    if (published && this.inStockVariantCount < 1) throw new Error('in_stock_variant_required')
    this.published = published
  }

  async uploadFile(path: string) {
    this.events.push(`upload:${path}`)
    this.uploadedPaths.push(path)
  }

  async copyFile(fromPath: string, toPath: string) {
    this.events.push(`copy:${fromPath}->${toPath}`)
    this.uploadedPaths.push(toPath)
  }

  async insertImage(_id: string, path: string, _alt?: string, color: string | null = null) {
    this.events.push(`insert-image:${path}${color ? `:${color}` : ''}`)
    if (this.failImageInsert) throw new Error('image row failed')
    this.imageCount += 1
  }

  async listImagePaths(id: string) {
    this.events.push(`list-images:${id}`)
    return Array.from({ length: this.imageCount }, (_, index) => ({
      path: `${id}/image-${index}.png`,
      alt: `圖片 ${index + 1}`,
      color: null,
    }))
  }

  async setImageColor(id: string, imageId: string, color: string | null) {
    if (this.failImageColor) throw new Error('product_image_color_invalid')
    this.events.push(`set-image-color:${id}:${imageId}:${color ?? 'shared'}`)
  }

  async removeFile(path: string) {
    this.events.push(`remove:${path}`)
    if (this.failImageRemove) throw new Error('storage remove failed')
    this.removedPaths.push(path)
  }

  async deleteImage(id: string, imageId: string) {
    this.events.push(`delete-image:${id}:${imageId}`)
    this.imageCount = Math.max(0, this.imageCount - 1)
    return `${id}/${imageId}.png`
  }

  async reorderImages(id: string, imageIds: string[]) {
    this.events.push(`reorder-images:${id}:${imageIds.join(',')}`)
  }

  async deleteProduct(id: string) {
    this.events.push(`delete:${id}`)
  }
}

function setup(
  repository = new MemoryProductRepository(),
  logError = vi.fn(),
  onChanged: (id: string) => void | Promise<void> = vi.fn(),
) {
  return {
    repository,
    logError,
    actions: createAdminProductActions({
      repository,
      loadProduct: async (id: string) => ({ id, isPublished: true, product, images: [] }),
      requireAdmin: async () => {
        repository.events.push('admin')
      },
      randomUUID: () => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      logError,
      onChanged,
    }),
  }
}

describe('admin product actions', () => {
  it('filters the management list by keyword, category, status and stock state', () => {
    const products = [
      { id: '1', name: '深海軍藍自在長褲', category: '褲裝', isPublished: true, totalStock: 8 },
      { id: '2', name: '雲朵包屁衣', category: '幼兒服', isPublished: false, totalStock: 0 },
    ]

    expect(filterAdminProductSummaries(products, { query: '藍', category: '褲裝', status: 'published', stock: 'in_stock' }))
      .toEqual([products[0]])
    expect(filterAdminProductSummaries(products, { query: '', category: '', status: 'draft', stock: 'sold_out' }))
      .toEqual([products[1]])
  })

  it('authorizes and removes a product image and its stored file', async () => {
    const { actions, repository } = setup()
    repository.imageCount = 2

    const result = await actions.deleteProductImage(productId, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')

    expect(result).toMatchObject({ ok: true, message: '商品圖片已刪除' })
    expect(repository.events).toEqual([
      'admin',
      `delete-image:${productId}:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee`,
      `remove:${productId}/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.png`,
    ])
  })

  it('authorizes and reorders existing product images without deleting files', async () => {
    const { actions, repository } = setup()
    const imageIds = [
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
    ]

    const result = await actions.reorderProductImages(productId, imageIds)

    expect(result).toMatchObject({ ok: true, message: '商品圖片順序已更新' })
    expect(repository.events).toEqual([
      'admin',
      `reorder-images:${productId}:${imageIds.join(',')}`,
    ])
    expect(repository.removedPaths).toEqual([])
  })

  it('duplicates a product as an unpublished draft with fresh variants and copied photos', async () => {
    const { actions, repository } = setup()
    repository.imageCount = 2

    const result = await actions.duplicateProduct(productId)

    expect(result).toMatchObject({ ok: true, productId })
    expect(result.message).toContain('草稿')
    expect(repository.savedProduct?.name).toBe('彩色口袋 Tee（複本）')
    expect(repository.savedProduct?.slug).not.toBe(product.slug)
    // The copy must not claim the original's rows, or saving it would move them.
    expect(repository.savedProduct?.variants.every((variant) => !variant.id && !variant.updatedAt)).toBe(true)
    expect(repository.savedProduct?.variants.map((variant) => variant.sku)).toEqual(['TEE-Y-100-COPY'])
    expect(repository.savedProduct?.isNew).toBe(false)
    expect(repository.events.filter((event) => event.startsWith('insert-image')).length).toBe(2)
    expect(repository.published).toBe(false)
  })

  it('still returns the duplicate when copying its photos fails', async () => {
    const { actions, repository, logError } = setup()
    repository.imageCount = 1
    repository.failImageInsert = true

    const result = await actions.duplicateProduct(productId)

    expect(result).toMatchObject({ ok: true, productId })
    expect(result.message).toContain('圖片未複製')
    expect(logError).toHaveBeenCalled()
  })

  it('authorizes and deletes the selected product', async () => {
    const { actions, repository } = setup()

    const result = await (actions as unknown as { deleteProduct: (id: string) => Promise<{ ok: boolean }> }).deleteProduct(productId)

    expect(result).toMatchObject({ ok: true })
    expect(repository.events).toEqual(['admin', `delete:${productId}`])
  })

  it('explains duplicate SKU and slug conflicts instead of a generic failure', async () => {
    const { actions, repository } = setup()
    repository.createProduct = async () => {
      throw Object.assign(new Error('duplicate key value violates unique constraint "product_variants_sku_lower_key"'), {
        details: 'Key (lower(sku))=(su05) already exists.',
      })
    }
    const skuConflict = await actions.createProduct({
      ...newProduct,
      variants: [
        { ...newProduct.variants[0], sku: 'SU05' },
        { ...newProduct.variants[0], sku: 'SU06', size: '110' },
      ],
    })
    expect(skuConflict).toMatchObject({
      ok: false,
      message: expect.stringContaining('SKU「su05」已被其他商品使用'),
    })
    // The conflicting row is marked so the red hint lands on that SKU input.
    expect(skuConflict.variantErrors?.[0]?.sku?.[0]).toContain('SKU「su05」已被其他商品使用')
    expect(skuConflict.variantErrors?.[1]).toBeUndefined()

    repository.createProduct = async () => {
      throw new Error('duplicate key value violates unique constraint "products_slug_key"')
    }
    const slugConflict = await actions.createProduct(newProduct)
    expect(slugConflict).toMatchObject({
      ok: false,
      message: expect.stringContaining('網址代稱已被其他商品使用'),
    })
    expect(slugConflict.fieldErrors?.slug?.[0]).toContain('網址代稱已被其他商品使用')
  })

  it('automatically generates SEO content when a product is created', async () => {
    const { actions, repository } = setup()
    const input = {
      ...newProduct,
      summary: '柔軟親膚、適合孩子日常活動的純棉上衣。',
      seoTitle: '不應保留的手動標題',
      seoDescription: '不應保留的手動描述',
    }

    await actions.createProduct(input)

    expect(repository.savedProduct).toMatchObject({
      seoTitle: '彩色口袋 Tee｜MORIMUR BABY',
      seoDescription: '柔軟親膚、適合孩子日常活動的純棉上衣。',
    })
  })
  it('rejects a stale edit after payment changes stock without restoring sold inventory', async () => {
    class VersionedProductRepository extends MemoryProductRepository {
      stock = 10
      version = initialVariantVersion

      completePayment() {
        this.stock = 9
        this.version = '2026-07-17T10:01:00.000Z'
      }

      override async updateProduct(id: string, input: ProductInput) {
        const variant = input.variants[0]
        if (variant.updatedAt !== this.version) throw new Error('stale_product_variant')
        await super.updateProduct(id, input)
        this.stock = variant.stock
      }
    }

    const repository = new VersionedProductRepository()
    const { actions } = setup(repository)
    const staleForm = {
      ...product,
      variants: [{ ...product.variants[0], stock: 10, updatedAt: initialVariantVersion }],
    }
    repository.completePayment()

    const result = await actions.updateProduct(productId, { ...staleForm, name: '付款後的新名稱' })

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('重新載入') })
    expect(repository.stock).toBe(9)
    expect(repository.savedProduct).toBeNull()
  })

  it('authorizes before create and update, and saves validated fields', async () => {
    const { actions, repository } = setup()

    await expect(actions.createProduct(newProduct)).resolves.toMatchObject({ ok: true, productId })
    expect(repository.events.slice(0, 2)).toEqual(['admin', 'create'])
    expect(repository.savedProduct).toEqual({
      ...newProduct,
      seoTitle: '彩色口袋 Tee｜MORIMUR BABY',
      seoDescription: '柔軟日常上衣',
    })

    repository.events.length = 0
    await expect(actions.updateProduct(productId, { ...product, name: '彩色 Tee' }))
      .resolves.toMatchObject({ ok: true, productId })
    expect(repository.events.slice(0, 2)).toEqual(['admin', `update:${productId}`])
    expect(repository.savedProduct?.name).toBe('彩色 Tee')
    expect(repository.savedProduct?.seoTitle).toBe('彩色 Tee｜MORIMUR BABY')
    expect(repository.savedProduct?.seoDescription).toBe('柔軟日常上衣')
    expect(repository.savedProduct?.variants[0]).toMatchObject({
      id: variantId,
      sku: 'TEE-Y-100',
    })
  })

  it('rejects stable variant IDs on product creation', async () => {
    const { actions, repository } = setup()

    const result = await actions.createProduct(product)

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('規格') })
    expect(repository.events).toEqual(['admin'])
  })

  it('rejects a stable variant ID that does not belong to the product', async () => {
    const repository = new MemoryProductRepository()
    repository.variantBelongsToProduct = false
    const { actions } = setup(repository)

    const result = await actions.updateProduct(productId, {
      ...product,
      variants: [{ ...product.variants[0], id: foreignVariantId }],
    })

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('規格') })
    expect(repository.savedProduct).toBeNull()
  })

  it('canonicalizes every SKU before the atomic product write', async () => {
    const { actions, repository } = setup()

    await actions.updateProduct(productId, {
      ...product,
      variants: [{ ...product.variants[0], sku: ' tee-y-100 ' }],
    })

    expect(repository.savedProduct?.variants[0].sku).toBe('TEE-Y-100')
  })

  it('authorizes before validation and does not persist invalid input', async () => {
    const { actions, repository } = setup()

    const result = await actions.createProduct({ ...newProduct, ageBands: [] })

    expect(result.ok).toBe(false)
    expect(repository.events).toEqual(['admin'])
    expect(repository.savedProduct).toBeNull()
  })

  it('rejects a negative variant cost before saving', async () => {
    const { actions, repository } = setup()

    const result = await actions.createProduct({
      ...newProduct,
      variants: [{ ...newProduct.variants[0], cost: -1 }],
    })

    expect(result).toMatchObject({ ok: false })
    expect(repository.savedProduct).toBeNull()
  })

  it('publishes only products with an image and an in-stock variant', async () => {
    const { actions, repository } = setup()

    await expect(actions.setProductPublished(productId, true))
      .resolves.toMatchObject({ ok: false, message: expect.stringContaining('圖片') })
    expect(repository.published).toBe(false)

    repository.imageCount = 1
    repository.inStockVariantCount = 0
    await expect(actions.setProductPublished(productId, true))
      .resolves.toMatchObject({ ok: false, message: expect.stringContaining('庫存') })
    expect(repository.published).toBe(false)

    repository.inStockVariantCount = 1
    repository.events.length = 0
    await expect(actions.setProductPublished(productId, true)).resolves.toMatchObject({ ok: true })
    expect(repository.events).toEqual([
      'admin',
      `publish:${productId}:true`,
    ])
    expect(repository.published).toBe(true)
  })

  it('allows an admin to unpublish without readiness checks', async () => {
    const { actions, repository } = setup()
    repository.published = true

    await expect(actions.setProductPublished(productId, false)).resolves.toMatchObject({ ok: true })

    expect(repository.events).toEqual(['admin', `publish:${productId}:false`])
    expect(repository.published).toBe(false)
  })

  it('returns fixed publish success messages for the requested target state', async () => {
    const { actions, repository } = setup()
    repository.imageCount = 1

    await expect(actions.setProductPublished(productId, true)).resolves.toMatchObject({
      ok: true,
      message: '商品已上架',
    })
    await expect(actions.setProductPublished(productId, false)).resolves.toMatchObject({
      ok: true,
      message: '商品已下架',
    })
  })

  it('keeps successful mutations successful when cache revalidation fails', async () => {
    const repository = new MemoryProductRepository()
    repository.imageCount = 1
    const logError = vi.fn()
    const onChanged = vi.fn().mockRejectedValue(new Error('cache unavailable'))
    const { actions } = setup(repository, logError, onChanged)

    await expect(actions.createProduct(newProduct)).resolves.toMatchObject({ ok: true })
    await expect(actions.updateProduct(productId, product)).resolves.toMatchObject({ ok: true })
    await expect(actions.setProductPublished(productId, true)).resolves.toMatchObject({ ok: true })
    await expect(actions.uploadProductImage(productId, {
      file: imageFile('image/png'),
      alt: '黃色口袋 Tee 正面',
    })).resolves.toMatchObject({ ok: true })

    expect(logError).toHaveBeenCalledTimes(4)
    expect(logError).toHaveBeenCalledWith('product admin cache refresh failed', { productId })
  })

  it('uploads to a unique product path and records required alt text', async () => {
    const { actions, repository } = setup()
    const file = imageFile('image/png')

    const result = await actions.uploadProductImage(productId, { file, alt: '黃色口袋 Tee 正面' })

    expect(result).toMatchObject({ ok: true })
    expect(repository.events).toEqual([
      'admin',
      `upload:${productId}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`,
      `insert-image:${productId}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`,
    ])
  })

  it('stores an allowed color while uploading a product image', async () => {
    const { actions, repository } = setup()

    const result = await actions.uploadProductImage(productId, {
      alt: '黃色上衣正面',
      color: '黃色',
      file: imageFile('image/png'),
    })

    expect(result.ok).toBe(true)
    expect(repository.events).toContain(
      `insert-image:${productId}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png:黃色`,
    )
  })

  it('updates an existing image color and reports an invalid color', async () => {
    const { actions, repository } = setup()

    await expect(actions.updateProductImageColor(productId, 'image-1', '黃色'))
      .resolves.toMatchObject({ ok: true, message: '圖片顏色已更新' })
    expect(repository.events).toContain(`set-image-color:${productId}:image-1:黃色`)

    repository.failImageColor = true
    await expect(actions.updateProductImageColor(productId, 'image-1', '不存在'))
      .resolves.toMatchObject({
        ok: false,
        message: '這個顏色已不在商品規格中，請重新選擇',
      })
  })

  it('removes a newly uploaded file when the image transaction fails', async () => {
    const repository = new MemoryProductRepository()
    repository.failImageInsert = true
    const { actions } = setup(repository)
    const file = imageFile('image/webp')

    const result = await actions.uploadProductImage(productId, { file, alt: '黃色口袋 Tee 正面' })
    const path = `${productId}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp`

    expect(result).toMatchObject({ ok: false })
    expect(repository.uploadedPaths).toEqual([path])
    expect(repository.removedPaths).toEqual([path])
    expect(repository.events).toEqual([
      'admin',
      `upload:${path}`,
      `insert-image:${path}`,
      `remove:${path}`,
    ])
  })

  it('reports and logs the storage path when failed transaction cleanup also fails', async () => {
    const repository = new MemoryProductRepository()
    repository.failImageInsert = true
    repository.failImageRemove = true
    const { actions, logError } = setup(repository)
    const path = `${productId}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp`

    const result = await actions.uploadProductImage(productId, {
      file: imageFile('image/webp'),
      alt: '黃色口袋 Tee 正面',
    })

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('清理') })
    expect(logError).toHaveBeenCalledWith('product image cleanup failed', { path })
  })
})

describe('admin product database contract', () => {
  const migrationPath = resolve(
    process.cwd(),
    'supabase/migrations/202607170005_product_admin_integrity.sql',
  )

  it('updates variants atomically by stable ID and deactivates omitted rows', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    const actions = readFileSync(
      resolve(process.cwd(), 'src/features/admin/product-actions.ts'),
      'utf8',
    )

    expect(sql).toMatch(/admin_create_product/)
    expect(sql).toMatch(/admin_update_product/)
    expect(sql).toMatch(/variant_not_owned/)
    expect(sql).toMatch(/is_active\s*=\s*false/i)
    expect(sql).toMatch(/security definer/i)
    expect(sql).toMatch(/public\.is_admin\(\)/)
    expect(actions).toMatch(/\.rpc\(['"]admin_create_product['"]/)
    expect(actions).toMatch(/\.rpc\(['"]admin_update_product['"]/)
    expect(actions).not.toMatch(/existingBySku|insertedIds|upsert\(currentVariants/)
  })

  it('publishes atomically and inserts image positions under a product lock', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toMatch(/admin_set_product_published/)
    expect(sql).toMatch(/product_image_required/)
    expect(sql).toMatch(/in_stock_variant_required/)
    expect(sql).toMatch(/admin_insert_product_image/)
    expect(sql).toMatch(/pg_advisory_xact_lock/)
  })

  it('enforces canonical SKU uniqueness and active public variants', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toMatch(/create unique index[\s\S]*lower\(sku\)/i)
    expect(sql).toMatch(/is_active\s+boolean\s+not null\s+default true/i)
    expect(sql).toMatch(/is_active\s+and/i)
  })

  it('loads and submits the variant updated_at concurrency token', () => {
    const actions = readFileSync(
      resolve(process.cwd(), 'src/features/admin/product-actions.ts'),
      'utf8',
    )

    expect(actions).toMatch(/product_variants\(id, sku, color, size, price, cost, compare_at_price, stock, updated_at\)/)
    expect(actions).toMatch(/updatedAt:\s*variant\.updated_at/)
  })
})

describe('admin product form', () => {
  it('allows multiple series from the selected category and clears them when category changes', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true, productId })
    const series: ProductSeries[] = [
      { id: '10000000-0000-4000-8000-000000000001', categoryName: '上衣', name: 'Mori flora 漫花系列', position: 0 },
      { id: '10000000-0000-4000-8000-000000000002', categoryName: '上衣', name: 'Mori forest 森林系列', position: 1 },
      { id: '10000000-0000-4000-8000-000000000003', categoryName: '褲裝', name: 'Mori daily 日常系列', position: 0 },
    ]
    const view = render(createElement(ProductForm, {
      initialProduct: { ...product, category: '上衣', seriesIds: [series[0].id, series[1].id] },
      onSave,
      categories: ['上衣', '褲裝'],
      series,
    }))
    const form = within(view.container)

    expect(form.getByRole('group', { name: '商品系列（可複選）' })).toBeInTheDocument()
    // Series are picked with + / ✓ toggle chips rather than checkboxes.
    expect(form.getByRole('button', { name: /Mori flora 漫花系列/ })).toHaveAttribute('aria-pressed', 'true')
    expect(form.getByRole('button', { name: /Mori forest 森林系列/ })).toHaveAttribute('aria-pressed', 'true')
    expect(form.queryByRole('button', { name: /Mori daily 日常系列/ })).not.toBeInTheDocument()

    fireEvent.change(form.getByLabelText('分類'), { target: { value: '褲裝' } })
    expect(form.getByRole('button', { name: /Mori daily 日常系列/ })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(form.getByRole('button', { name: '儲存商品' }))
    fireEvent.click(await form.findByRole('button', { name: '確定儲存' }))

    await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      category: '褲裝',
      seriesIds: [],
    })))
    view.unmount()
  })

  it('rejects a scheduled sale time in the past and exposes a minimum selectable time', () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true, productId })
    const view = render(createElement(ProductForm, { initialProduct: product, onSave }))
    const form = within(view.container)
    const scheduledAt = form.getByLabelText(/預約開賣時間/)

    expect(scheduledAt).toHaveAttribute('min')
    fireEvent.change(scheduledAt, { target: { value: '2020-01-01T00:00' } })
    fireEvent.click(form.getByRole('button', { name: '儲存商品' }))

    expect(form.getByText('預約開賣時間必須晚於現在')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
    view.unmount()
  })

  it('keeps the category control in the same field rhythm as adjacent inputs', () => {
    const view = render(createElement(ProductForm, { initialProduct: product, onSave: vi.fn() }))
    const form = within(view.container)
    const category = form.getByLabelText('分類')
    const manageLink = form.getByRole('link', { name: /管理分類/ })

    expect(category.parentElement).toHaveClass('admin-category-field')
    expect(category.compareDocumentPosition(manageLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(category.parentElement?.querySelector('.admin-field-label-row')).toBeNull()
    view.unmount()
  })

  it('shows an actionable image error when Next rejects the Server Action body', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('Body exceeded 1 MB limit'))
    const view = render(createElement(ImageUploader, { upload }))
    const uploader = within(view.container)

    fireEvent.change(uploader.getByLabelText('圖片'), {
      target: { files: [imageFile('image/png')] },
    })
    fireEvent.change(uploader.getByLabelText('圖片替代文字'), {
      target: { value: '黃色口袋 Tee 正面' },
    })
    fireEvent.submit(uploader.getByRole('button', { name: '上傳圖片' }).closest('form')!)

    expect(await uploader.findByRole('alert')).toHaveTextContent('圖片上傳失敗')
    expect(uploader.getByRole('alert')).toHaveTextContent('5 MB')
    view.unmount()
  })

  it('lets the owner assign each selected new image to a variant color', async () => {
    const view = render(createElement(ProductForm, {
      initialProduct: newProduct,
      onSave: vi.fn(),
      requireImage: true,
    }))
    const form = within(view.container)

    fireEvent.change(form.getByLabelText('商品圖片'), {
      target: { files: [imageFile('image/png'), imageFile('image/png')] },
    })

    await vi.waitFor(() => {
      expect(form.getAllByLabelText(/圖片 \d+ 對應顏色/)).toHaveLength(2)
    })
    expect(form.getAllByRole('option', { name: '黃色' })).toHaveLength(2)
    expect(form.getAllByRole('option', { name: '共用圖片' })).toHaveLength(2)
    view.unmount()
  })

  it('includes a shared-image color option in the standalone uploader', () => {
    const view = render(createElement(ImageUploader, {
      upload: vi.fn(),
      colors: ['黃色', '藍色'],
    }))
    const uploader = within(view.container)

    expect(uploader.getByLabelText('對應顏色')).toHaveValue('')
    expect(uploader.getByRole('option', { name: '共用圖片' })).toBeInTheDocument()
    expect(uploader.getByRole('option', { name: '藍色' })).toBeInTheDocument()
    view.unmount()
  })

  it('adds and removes concrete color-size rows', () => {
    function VariantHarness() {
      const [variants, setVariants] = useState(product.variants)
      return createElement(VariantGrid, { variants, onChange: setVariants })
    }

    const view = render(createElement(VariantHarness))
    expect(screen.getAllByLabelText('SKU')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: '新增規格' }))
    expect(screen.getAllByLabelText('SKU')).toHaveLength(2)

    fireEvent.click(screen.getAllByRole('button', { name: '移除規格' })[1])
    expect(screen.getAllByLabelText('SKU')).toHaveLength(1)
    view.unmount()
  })

  it('generates every colour and size combination from the bulk panel', () => {
    function VariantHarness() {
      const [variants, setVariants] = useState(product.variants)
      return createElement(VariantGrid, { variants, onChange: setVariants, sizeOptions: ['100', '110'] })
    }

    const view = render(createElement(VariantHarness))
    const grid = within(view.container)

    fireEvent.click(grid.getByRole('button', { name: /批次產生規格/ }))
    fireEvent.change(grid.getByLabelText('批次顏色'), { target: { value: '米白、霧綠' } })
    fireEvent.click(grid.getByRole('button', { name: '100' }))
    fireEvent.click(grid.getByRole('button', { name: '110' }))
    fireEvent.change(grid.getByLabelText('批次售價'), { target: { value: '680' } })

    // 4 new rows on top of the single existing 黃色/100 spec.
    expect(grid.getByRole('button', { name: '產生規格' })).toBeEnabled()
    fireEvent.click(grid.getByRole('button', { name: '產生規格' }))

    expect(grid.getAllByLabelText('SKU')).toHaveLength(5)
    expect(grid.getAllByLabelText('售價').slice(-4).map((input) => (input as HTMLInputElement).value))
      .toEqual(['680', '680', '680', '680'])
    expect(grid.getByRole('status').textContent).toContain('已新增 4 個規格')
    view.unmount()
  })

  it('has an explicit Save button and submits approved product fields', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true, productId, message: '商品修改已儲存' })
    const view = render(createElement('div', null,
      createElement(ProductForm, { initialProduct: product, onSave }),
      createElement(Toaster),
    ))
    const form = within(view.container)

    fireEvent.change(form.getByLabelText('商品名稱'), { target: { value: '彩色 Tee' } })
    fireEvent.click(form.getByRole('button', { name: '儲存商品' }))
    fireEvent.click(await form.findByRole('button', { name: '確定儲存' }))

    await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...product, name: '彩色 Tee' }))
    // Success now surfaces as a floating toast instead of inline savebar text.
    expect((await form.findAllByRole('status')).some((status) => status.textContent?.includes('商品修改已儲存'))).toBe(true)
    view.unmount()
  })

  it('updates the create progress from content through variants and images', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true, productId })
    const view = render(createElement(ProductForm, {
      initialProduct: {
        ...newProduct,
        name: '',
        slug: '',
        category: '',
        ageBands: [],
        description: '',
        material: '',
        careInstructions: '',
        sizeGuide: '',
        variants: [{ sku: '', color: '', size: '', price: 0, stock: 0 }],
      },
      onSave,
      requireImage: true,
    }))
    const form = within(view.container)

    expect(form.getByRole('progressbar', { name: '商品建立進度' })).toHaveAttribute('aria-valuenow', '0')
    expect(form.getByText('01 商品內容')).toHaveAttribute('data-active', 'true')

    fireEvent.change(form.getByLabelText('商品名稱'), { target: { value: '彩色口袋 Tee' } })
    fireEvent.change(form.getByLabelText(/網址代稱/), { target: { value: 'color-pocket-tee' } })
    fireEvent.change(form.getByLabelText('分類'), { target: { value: '上衣' } })
    fireEvent.click(form.getByRole('checkbox', { name: /Kids/ }))
    // Name, category and age are all step 01 needs; the descriptive copy is
    // recommended rather than required.
    expect(form.getByText('02 規格庫存')).toHaveAttribute('data-active', 'true')
    fireEvent.change(form.getByLabelText(/商品說明/), { target: { value: '柔軟日常上衣' } })
    fireEvent.change(form.getByLabelText(/材質/), { target: { value: '100% 棉' } })
    fireEvent.change(form.getByLabelText('尺寸指南'), { target: { value: '正常版型' } })
    fireEvent.change(form.getByLabelText(/洗滌說明/), { target: { value: '冷水洗滌' } })

    fireEvent.change(form.getByLabelText('SKU'), { target: { value: 'TEE-Y-100' } })
    fireEvent.change(form.getByLabelText('顏色'), { target: { value: '黃色' } })
    fireEvent.change(form.getByLabelText('尺寸', { exact: true }), { target: { value: '100' } })
    fireEvent.change(form.getByLabelText('售價'), { target: { value: '590' } })
    fireEvent.change(form.getByLabelText('成本'), { target: { value: '260' } })
    fireEvent.change(form.getByLabelText('庫存'), { target: { value: '3' } })
    expect(form.getByText('03 商品圖片')).toHaveAttribute('data-active', 'true')

    fireEvent.change(form.getByLabelText('商品圖片'), { target: { files: [imageFile('image/png')] } })
    fireEvent.change(form.getByLabelText('圖片說明'), { target: { value: '黃色口袋 Tee 正面' } })
    // Selected photos are downscaled asynchronously before they count as chosen.
    await vi.waitFor(() => expect(form.getByText('04 確認建立')).toHaveAttribute('data-active', 'true'))
    expect(form.getByRole('progressbar', { name: '商品建立進度' })).toHaveAttribute('aria-valuenow', '100')
    view.unmount()
  })

  it('saves without the descriptive copy but says what is still worth adding', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true, productId })
    const view = render(createElement(ProductForm, {
      initialProduct: {
        ...product,
        description: '',
        material: '',
        careInstructions: '',
        sizeGuide: '',
      },
      onSave,
    }))

    const form = within(view.container)
    // Nudged, not blocked: these fields make a better page but are not required.
    expect(form.getByText(/建議補上：商品說明、材質、尺寸指南、洗滌說明/)).toBeInTheDocument()

    fireEvent.click(form.getByRole('button', { name: '儲存商品' }))
    fireEvent.click(await form.findByRole('button', { name: '確定儲存' }))

    await vi.waitFor(() => expect(onSave).toHaveBeenCalled())
    view.unmount()
  })

  it('numbers a blank SKU instead of refusing to save', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true, productId })
    const view = render(createElement(ProductForm, {
      initialProduct: { ...newProduct, variants: [{ ...newProduct.variants[0], sku: '' }] },
      onSave,
    }))
    const form = within(view.container)

    fireEvent.click(form.getByRole('button', { name: '儲存商品' }))
    fireEvent.click(await form.findByRole('button', { name: '確定儲存' }))

    await vi.waitFor(() => expect(onSave).toHaveBeenCalled())
    const saved = onSave.mock.calls[0][0] as ProductInput
    expect(saved.variants[0].sku).toMatch(/^MORI-[A-Z0-9]{1,4}-01-100$/)
    view.unmount()
  })

  it('reuses material, care and measurements from the last product or the store defaults', async () => {
    const saveContentDefaults = vi.fn().mockResolvedValue({ ok: true, message: '已設為商店預設，下次新增商品會自動帶入' })
    const view = render(createElement('div', null,
      createElement(ProductForm, {
        initialProduct: { ...newProduct, material: '', careInstructions: '', sizeGuide: '' },
        onSave: vi.fn(),
        contentSources: {
          defaults: { material: '95% 棉 5% 彈性纖維', careInstructions: '冷水手洗', sizeGuide: '版型：正常版型' },
          previous: { name: '雲朵包屁衣', material: '100% 有機棉', careInstructions: '洗衣袋冷洗', sizeGuide: '版型：寬鬆' },
        },
        saveContentDefaults,
      }),
      createElement(Toaster),
    ))
    const form = within(view.container)

    fireEvent.click(form.getByRole('button', { name: /沿用上一件（雲朵包屁衣）/ }))
    expect(form.getByLabelText(/材質/)).toHaveValue('100% 有機棉')
    expect(form.getByLabelText(/洗滌說明/)).toHaveValue('洗衣袋冷洗')
    expect(form.getByLabelText('尺寸指南')).toHaveValue('版型：寬鬆')

    fireEvent.click(form.getByRole('button', { name: '套用商店預設' }))
    expect(form.getByLabelText(/材質/)).toHaveValue('95% 棉 5% 彈性纖維')

    fireEvent.click(form.getByRole('button', { name: '把目前內容設為商店預設' }))
    await vi.waitFor(() => expect(saveContentDefaults).toHaveBeenCalledWith({
      material: '95% 棉 5% 彈性纖維',
      careInstructions: '冷水手洗',
      sizeGuide: '版型：正常版型',
    }))
    view.unmount()
  })

  it('does not ask the owner to enter SEO fields manually', () => {
    const view = render(createElement(ProductForm, { initialProduct: product, onSave: vi.fn() }))
    const form = within(view.container)

    expect(form.queryByRole('heading', { name: /SEO 設定/ })).not.toBeInTheDocument()
    expect(form.queryByLabelText('SEO 標題')).not.toBeInTheDocument()
    expect(form.queryByLabelText('SEO 描述')).not.toBeInTheDocument()
    view.unmount()
  })

  it('shows the exact single-variant error and saves after that field is corrected', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true, productId })
    const view = render(createElement(ProductForm, {
      initialProduct: {
        ...newProduct,
        variants: [{ ...newProduct.variants[0], compareAtPrice: 500 }],
      },
      onSave,
    }))
    const form = within(view.container)

    fireEvent.click(form.getByRole('button', { name: '儲存商品' }))
    expect(form.getByText('原價不可低於售價')).toBeInTheDocument()
    expect(form.getByText('請修正上方紅色標示的規格欄位；只建立一種規格也可以儲存。'))
      .toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()

    fireEvent.change(form.getByLabelText('原價'), { target: { value: '' } })
    expect(form.queryByText('原價不可低於售價')).not.toBeInTheDocument()
    fireEvent.click(form.getByRole('button', { name: '儲存商品' }))
    fireEvent.click(await form.findByRole('button', { name: '確定儲存' }))
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    view.unmount()
  })

  it('remounts with canonical IDs after adding and saving a new variant', async () => {
    const editPage = readFileSync(
      resolve(process.cwd(), 'src/app/admin/products/[id]/edit/page.tsx'),
      'utf8',
    )
    expect(editPage).toMatch(/variantSignature/)
    expect(editPage).toMatch(/<ProductForm key=\{variantSignature\}/)
    expect(editPage).toMatch(/variant\.updatedAt/)

    const onSave = vi.fn().mockResolvedValue({ ok: true, productId })
    const initialSignature = product.variants.map((variant) => variant.id).sort().join(':')
    const view = render(createElement(ProductForm, {
      key: initialSignature,
      initialProduct: product,
      onSave,
    }))
    const form = within(view.container)

    fireEvent.click(form.getByRole('button', { name: '新增規格' }))
    fireEvent.change(form.getAllByLabelText('SKU')[1], { target: { value: 'TEE-Y-110' } })
    fireEvent.change(form.getAllByLabelText('顏色')[1], { target: { value: '黃色' } })
    fireEvent.change(form.getAllByLabelText('尺寸')[1], { target: { value: '110' } })
    fireEvent.change(form.getAllByLabelText('售價')[1], { target: { value: '590' } })
    fireEvent.change(form.getAllByLabelText('庫存')[1], { target: { value: '2' } })
    fireEvent.click(form.getByRole('button', { name: '儲存商品' }))
    fireEvent.click(await form.findByRole('button', { name: '確定儲存' }))
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].variants[1].id).toBeUndefined()

    const canonicalVariantId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    const canonicalProduct: ProductInput = {
      ...product,
      variants: [
        product.variants[0],
        {
          id: canonicalVariantId,
          updatedAt: '2026-07-17T10:02:00.000Z',
          sku: 'TEE-Y-110',
          color: '黃色',
          size: '110',
          price: 590,
          stock: 2,
        },
      ],
    }
    const canonicalSignature = canonicalProduct.variants
      .map((variant) => variant.id)
      .sort()
      .join(':')
    view.rerender(createElement(ProductForm, {
      key: canonicalSignature,
      initialProduct: canonicalProduct,
      onSave,
    }))
    fireEvent.click(form.getByRole('button', { name: '儲存商品' }))
    fireEvent.click(await form.findByRole('button', { name: '確定儲存' }))

    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onSave.mock.calls[1][0].variants.map((variant: ProductInput['variants'][number]) => variant.id))
      .toEqual([variantId, canonicalVariantId])
  })

  it('shows the atomic publish error instead of discarding the action result', async () => {
    const onToggle = vi.fn().mockResolvedValue({
      ok: false,
      message: '商品至少需要一張圖片才能上架',
    })
    render(createElement('div', null,
      createElement(ProductPublishForm, { isPublished: false, onToggle }),
      createElement(Toaster),
    ))

    fireEvent.click(screen.getByRole('button', { name: '上架商品' }))

    // Errors now surface as a floating toast.
    expect(await screen.findByRole('status')).toHaveTextContent('商品至少需要一張圖片才能上架')
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('shows the publish success message returned by the action', async () => {
    const onToggle = vi.fn().mockResolvedValue({ ok: true, message: '商品已上架' })
    const view = render(createElement('div', null,
      createElement(ProductPublishForm, { isPublished: false, onToggle }),
      createElement(Toaster),
    ))
    const form = within(view.container)

    fireEvent.click(form.getByRole('button', { name: '上架商品' }))

    // Success now surfaces as a floating toast that auto-dismisses.
    expect(await form.findByRole('status')).toHaveTextContent('商品已上架')
    await vi.waitFor(
      () => expect(form.queryByRole('status')).not.toBeInTheDocument(),
      { timeout: 4000, interval: 100 },
    )
  })
})
