import { describe, expect, it } from 'vitest'
import { productSchema, productImageSchema } from '@/lib/validation/product'

const validProduct = {
  name: '彩色口袋 Tee',
  slug: 'color-pocket-tee',
  category: 'tops',
  ageBands: ['3-5'],
  description: '',
  material: '',
  careInstructions: '',
  sizeGuide: '',
  isNew: false,
  variants: [
    { sku: 'TEE-Y-100', color: '黃色', size: '100', price: 590, stock: 3 },
  ],
}

const variantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function imageFile(type: 'image/jpeg' | 'image/png' | 'image/webp', size?: number) {
  const signature = {
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    'image/webp': [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
  }[type]
  const bytes = new Uint8Array(size ?? signature.length)
  bytes.set(signature)
  return new File([bytes], 'image', { type })
}

describe('productSchema', () => {
  it('accepts the approved product fields', () => {
    expect(productSchema.safeParse(validProduct).success).toBe(true)
  })

  it('requires only the fields named by the product contract', () => {
    const result = productSchema.safeParse({
      name: '彩色口袋 Tee',
      slug: 'color-pocket-tee',
      category: 'tops',
      ageBands: ['3-5'],
      variants: [
        { sku: 'TEE-Y-100', color: '黃色', size: '100', price: 590, stock: 3 },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      description: '',
      material: '',
      careInstructions: '',
      sizeGuide: '',
      isNew: false,
    })
  })

  it('rejects duplicate color and size combinations', () => {
    const result = productSchema.safeParse({
      ...validProduct,
      variants: [
        { sku: 'TEE-Y-100', color: '黃色', size: '100', price: 590, stock: 3 },
        { sku: 'TEE-Y-101', color: '黃色', size: '100', price: 590, stock: 2 },
      ],
    })

    expect(result.success).toBe(false)
  })

  it('rejects duplicate SKUs', () => {
    const result = productSchema.safeParse({
      ...validProduct,
      variants: [
        { sku: 'TEE-Y-100', color: '黃色', size: '100', price: 590, stock: 3 },
        { sku: 'tee-y-100', color: '黃色', size: '110', price: 590, stock: 2 },
      ],
    })

    expect(result.success).toBe(false)
  })

  it('accepts stable variant IDs and canonicalizes SKUs to uppercase', () => {
    const result = productSchema.safeParse({
      ...validProduct,
      variants: [{
        ...validProduct.variants[0],
        id: variantId,
        updatedAt: '2026-07-17T10:00:00.000Z',
        sku: ' tee-y-100 ',
      }],
    })

    expect(result.success).toBe(true)
    expect(result.data?.variants[0]).toMatchObject({ id: variantId, sku: 'TEE-Y-100' })
  })

  it('requires an updated_at concurrency token for existing variants only', () => {
    const existingWithoutVersion = productSchema.safeParse({
      ...validProduct,
      variants: [{ ...validProduct.variants[0], id: variantId }],
    })
    const existingWithVersion = productSchema.safeParse({
      ...validProduct,
      variants: [{
        ...validProduct.variants[0],
        id: variantId,
        updatedAt: '2026-07-17T10:00:00.000Z',
      }],
    })

    expect(existingWithoutVersion.success).toBe(false)
    expect(existingWithVersion.success).toBe(true)
  })

  it('rejects malformed stable variant IDs', () => {
    expect(productSchema.safeParse({
      ...validProduct,
      variants: [{ ...validProduct.variants[0], id: 'not-a-uuid' }],
    }).success).toBe(false)
  })

  it('rejects duplicate stable variant IDs', () => {
    expect(productSchema.safeParse({
      ...validProduct,
      variants: [
        { ...validProduct.variants[0], id: variantId },
        {
          ...validProduct.variants[0],
          id: variantId,
          sku: 'TEE-Y-110',
          size: '110',
        },
      ],
    }).success).toBe(false)
  })

  it.each([
    ['missing age band', { ...validProduct, ageBands: [] }],
    ['missing variant', { ...validProduct, variants: [] }],
    ['fractional price', { ...validProduct, variants: [{ ...validProduct.variants[0], price: 590.5 }] }],
    ['negative price', { ...validProduct, variants: [{ ...validProduct.variants[0], price: -1 }] }],
    ['fractional stock', { ...validProduct, variants: [{ ...validProduct.variants[0], stock: 1.5 }] }],
    ['negative stock', { ...validProduct, variants: [{ ...validProduct.variants[0], stock: -1 }] }],
    ['low compare-at price', {
      ...validProduct,
      variants: [{ ...validProduct.variants[0], compareAtPrice: 589 }],
    }],
  ])('rejects %s', (_name, product) => {
    expect(productSchema.safeParse(product).success).toBe(false)
  })

  it('rejects fields outside the approved shape', () => {
    expect(productSchema.safeParse({ ...validProduct, featured: true }).success).toBe(false)
    expect(productSchema.safeParse({
      ...validProduct,
      variants: [{ ...validProduct.variants[0], barcode: '123' }],
    }).success).toBe(false)
  })
})

describe('productImageSchema', () => {
  it('accepts magic-valid JPEG, PNG and WebP files above 1 MB and up to 5 MB', async () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      const file = imageFile(type as 'image/jpeg' | 'image/png' | 'image/webp', 5 * 1024 * 1024)
      expect((await productImageSchema.safeParseAsync({
        alt: '孩子穿著彩色口袋 Tee',
        file,
      })).success).toBe(true)
    }
  })

  it('rejects missing alt text, unsupported types and files over 5 MB', async () => {
    const jpeg = imageFile('image/jpeg')
    const gif = new File(['image'], 'image.gif', { type: 'image/gif' })
    const tooLarge = imageFile('image/webp', 5 * 1024 * 1024 + 1)

    expect((await productImageSchema.safeParseAsync({ alt: '', file: jpeg })).success).toBe(false)
    expect((await productImageSchema.safeParseAsync({ alt: '商品圖', file: gif })).success).toBe(false)
    expect((await productImageSchema.safeParseAsync({ alt: '商品圖', file: tooLarge })).success).toBe(false)
  })

  it('rejects files whose declared MIME type does not match their magic bytes', async () => {
    const fakePng = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'fake.png', {
      type: 'image/png',
    })

    expect((await productImageSchema.safeParseAsync({
      alt: '商品圖',
      file: fakePng,
    })).success).toBe(false)
  })
})
