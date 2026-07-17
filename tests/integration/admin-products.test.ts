import { createElement, useState } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  createAdminProductActions,
  type ProductRepository,
} from '@/features/admin/product-actions'
import type { ProductInput } from '@/lib/validation/product'
import { ProductForm, ProductPublishForm } from '@/features/admin/product-form'
import { VariantGrid } from '@/features/admin/variant-grid'

const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const variantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const foreignVariantId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

const product: ProductInput = {
  name: '彩色口袋 Tee',
  slug: 'color-pocket-tee',
  category: 'tops',
  ageBands: ['3-5'],
  description: '柔軟日常上衣',
  material: '100% 棉',
  careInstructions: '冷水洗滌',
  sizeGuide: '正常版型',
  isNew: true,
  variants: [
    { id: variantId, sku: 'TEE-Y-100', color: '黃色', size: '100', price: 590, stock: 3 },
  ],
}

const newProduct: ProductInput = {
  ...product,
  variants: product.variants.map((variant) => ({
    sku: variant.sku,
    color: variant.color,
    size: variant.size,
    price: variant.price,
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

  async insertImage(_id: string, path: string) {
    this.events.push(`insert-image:${path}`)
    if (this.failImageInsert) throw new Error('image row failed')
    this.imageCount += 1
  }

  async removeFile(path: string) {
    this.events.push(`remove:${path}`)
    if (this.failImageRemove) throw new Error('storage remove failed')
    this.removedPaths.push(path)
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
  it('authorizes before create and update, and saves validated fields', async () => {
    const { actions, repository } = setup()

    await expect(actions.createProduct(newProduct)).resolves.toMatchObject({ ok: true, productId })
    expect(repository.events.slice(0, 2)).toEqual(['admin', 'create'])
    expect(repository.savedProduct).toEqual(newProduct)

    repository.events.length = 0
    await expect(actions.updateProduct(productId, { ...product, name: '彩色 Tee' }))
      .resolves.toMatchObject({ ok: true, productId })
    expect(repository.events.slice(0, 2)).toEqual(['admin', `update:${productId}`])
    expect(repository.savedProduct?.name).toBe('彩色 Tee')
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
    expect(actions).not.toMatch(/existingBySku|insertedIds|upsert\(currentVariants|from\(['"]products['"]\)\.delete/)
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
})

describe('admin product form', () => {
  it('adds and removes concrete color-size rows', () => {
    function VariantHarness() {
      const [variants, setVariants] = useState(product.variants)
      return createElement(VariantGrid, { variants, onChange: setVariants })
    }

    render(createElement(VariantHarness))
    expect(screen.getAllByLabelText('SKU')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: '新增規格' }))
    expect(screen.getAllByLabelText('SKU')).toHaveLength(2)

    fireEvent.click(screen.getAllByRole('button', { name: '移除規格' })[1])
    expect(screen.getAllByLabelText('SKU')).toHaveLength(1)
  })

  it('has an explicit Save button and submits approved product fields', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true, productId })
    render(createElement(ProductForm, { initialProduct: product, onSave }))

    fireEvent.change(screen.getByLabelText('商品名稱'), { target: { value: '彩色 Tee' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存商品' }))

    await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...product, name: '彩色 Tee' }))
  })

  it('remounts with canonical IDs after adding and saving a new variant', async () => {
    const editPage = readFileSync(
      resolve(process.cwd(), 'src/app/admin/products/[id]/edit/page.tsx'),
      'utf8',
    )
    expect(editPage).toMatch(/variantSignature/)
    expect(editPage).toMatch(/<ProductForm key=\{variantSignature\}/)

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
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].variants[1].id).toBeUndefined()

    const canonicalVariantId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    const canonicalProduct: ProductInput = {
      ...product,
      variants: [
        product.variants[0],
        {
          id: canonicalVariantId,
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

    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onSave.mock.calls[1][0].variants.map((variant: ProductInput['variants'][number]) => variant.id))
      .toEqual([variantId, canonicalVariantId])
  })

  it('shows the atomic publish error instead of discarding the action result', async () => {
    const onToggle = vi.fn().mockResolvedValue({
      ok: false,
      message: '商品至少需要一張圖片才能上架',
    })
    render(createElement(ProductPublishForm, { isPublished: false, onToggle }))

    fireEvent.click(screen.getByRole('button', { name: '上架商品' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('商品至少需要一張圖片才能上架')
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('shows the publish success message returned by the action', async () => {
    const onToggle = vi.fn().mockResolvedValue({ ok: true, message: '商品已上架' })
    const view = render(createElement(ProductPublishForm, { isPublished: false, onToggle }))
    const form = within(view.container)

    fireEvent.click(form.getByRole('button', { name: '上架商品' }))

    expect(await form.findByRole('status')).toHaveTextContent('商品已上架')
    expect(form.queryByRole('alert')).not.toBeInTheDocument()
  })
})
