import { z } from 'zod'

const ageBandSchema = z.enum(['0-2', '3-5', '6-9', '10-12'])

const variantSchema = z.object({
  id: z.string().uuid('商品規格編號無效').optional(),
  sku: z.string().trim().min(1, 'SKU 為必填').transform((sku) => sku.toUpperCase()),
  color: z.string().trim().min(1, '顏色為必填'),
  size: z.string().trim().min(1, '尺寸為必填'),
  price: z.number().int('售價必須是整數').nonnegative('售價不可小於 0'),
  compareAtPrice: z.number().int('原價必須是整數').nonnegative('原價不可小於 0').optional(),
  stock: z.number().int('庫存必須是整數').nonnegative('庫存不可小於 0'),
}).strict().refine(
  (variant) => variant.compareAtPrice === undefined || variant.compareAtPrice >= variant.price,
  { message: '原價不可低於售價', path: ['compareAtPrice'] },
)

export const productSchema = z.object({
  name: z.string().trim().min(1, '商品名稱為必填'),
  slug: z.string().trim().min(1, '網址代稱為必填'),
  category: z.string().trim().min(1, '分類為必填'),
  ageBands: z.array(ageBandSchema).min(1, '至少選擇一個年齡層'),
  description: z.string().default(''),
  material: z.string().default(''),
  careInstructions: z.string().default(''),
  sizeGuide: z.string().default(''),
  isNew: z.boolean().default(false),
  variants: z.array(variantSchema).min(1, '至少需要一個商品規格'),
}).strict().superRefine((product, context) => {
  const skus = new Set<string>()
  const combinations = new Set<string>()
  const ids = new Set<string>()

  product.variants.forEach((variant, index) => {
    if (variant.id && ids.has(variant.id)) {
      context.addIssue({
        code: 'custom',
        message: '商品規格編號不可重複',
        path: ['variants', index, 'id'],
      })
    }
    if (variant.id) ids.add(variant.id)

    const sku = variant.sku.toLocaleLowerCase()
    if (skus.has(sku)) {
      context.addIssue({
        code: 'custom',
        message: 'SKU 不可重複',
        path: ['variants', index, 'sku'],
      })
    }
    skus.add(sku)

    const combination = `${variant.color.toLocaleLowerCase()}\u0000${variant.size.toLocaleLowerCase()}`
    if (combinations.has(combination)) {
      context.addIssue({
        code: 'custom',
        message: '顏色與尺寸組合不可重複',
        path: ['variants', index, 'size'],
      })
    }
    combinations.add(combination)
  })
})

const imageFileSchema = z.custom<File>(
  (value) => typeof File !== 'undefined' && value instanceof File,
  '請選擇圖片',
).refine(
  (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
  '圖片只支援 JPEG、PNG 或 WebP',
).refine(
  (file) => file.size <= 5 * 1024 * 1024,
  '圖片不可超過 5 MB',
).refine(
  async (file) => {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
    if (file.type === 'image/jpeg') {
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    }
    if (file.type === 'image/png') {
      const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      return png.every((byte, index) => bytes[index] === byte)
    }
    if (file.type === 'image/webp') {
      return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
        && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    }
    return false
  },
  '圖片內容與檔案類型不符',
)

export const productImageSchema = z.object({
  alt: z.string().trim().min(1, '圖片替代文字為必填'),
  file: imageFileSchema,
}).strict()

export type ProductInput = z.infer<typeof productSchema>
