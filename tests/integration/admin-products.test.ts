import { createElement, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  createAdminProductActions,
  type ProductRepository,
} from '@/features/admin/product-actions'
import type { ProductInput } from '@/lib/validation/product'
import { ProductForm } from '@/features/admin/product-form'
import { VariantGrid } from '@/features/admin/variant-grid'

const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

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
    { sku: 'TEE-Y-100', color: '黃色', size: '100', price: 590, stock: 3 },
  ],
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

  async createProduct(input: ProductInput) {
    this.events.push('create')
    this.savedProduct = input
    return productId
  }

  async updateProduct(id: string, input: ProductInput) {
    this.events.push(`update:${id}`)
    this.savedProduct = input
  }

  async getPublishReadiness(id: string) {
    this.events.push(`readiness:${id}`)
    return {
      imageCount: this.imageCount,
      inStockVariantCount: this.inStockVariantCount,
    }
  }

  async setPublished(id: string, published: boolean) {
    this.events.push(`publish:${id}:${published}`)
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
    this.removedPaths.push(path)
  }
}

function setup(repository = new MemoryProductRepository()) {
  return {
    repository,
    actions: createAdminProductActions({
      repository,
      requireAdmin: async () => {
        repository.events.push('admin')
      },
      randomUUID: () => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }),
  }
}

describe('admin product actions', () => {
  it('authorizes before create and update, and saves validated fields', async () => {
    const { actions, repository } = setup()

    await expect(actions.createProduct(product)).resolves.toMatchObject({ ok: true, productId })
    expect(repository.events.slice(0, 2)).toEqual(['admin', 'create'])
    expect(repository.savedProduct).toEqual(product)

    repository.events.length = 0
    await expect(actions.updateProduct(productId, { ...product, name: '彩色 Tee' }))
      .resolves.toMatchObject({ ok: true, productId })
    expect(repository.events.slice(0, 2)).toEqual(['admin', `update:${productId}`])
    expect(repository.savedProduct?.name).toBe('彩色 Tee')
  })

  it('authorizes before validation and does not persist invalid input', async () => {
    const { actions, repository } = setup()

    const result = await actions.createProduct({ ...product, ageBands: [] })

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
      `readiness:${productId}`,
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

  it('uploads to a unique product path and records required alt text', async () => {
    const { actions, repository } = setup()
    const file = new File(['image'], 'shirt.png', { type: 'image/png' })

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
    const file = new File(['image'], 'shirt.webp', { type: 'image/webp' })

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
})
