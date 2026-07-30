import { z } from 'zod'

const ageBandSchema = z.enum(['0-3', '3-6', '6-12'])

const variantSchema = z.object({
  id: z.string().uuid('商品規格編號無效').optional(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
  sku: z.string().trim().min(1, 'SKU 為必填').transform((sku) => sku.toUpperCase()),
  color: z.string().trim().min(1, '顏色為必填'),
  size: z.string().trim().min(1, '尺寸為必填'),
  price: z.number().int('售價必須是整數').nonnegative('售價不可小於 0'),
  cost: z.number().int('成本必須是整數').nonnegative('成本不可小於 0').optional(),
  compareAtPrice: z.number().int('原價必須是整數').nonnegative('原價不可小於 0').optional(),
  stock: z.number().int('庫存必須是整數').nonnegative('庫存不可小於 0'),
}).strict().refine(
  (variant) => variant.compareAtPrice === undefined || variant.compareAtPrice >= variant.price,
  { message: '原價不可低於售價', path: ['compareAtPrice'] },
)

export const productSchema = z.object({
  name: z.string().trim().min(1, '商品名稱為必填'),
  slug: z.string().trim().default(''),
  category: z.string().trim().min(1, '分類為必填'),
  ageBands: z.array(ageBandSchema).min(1, '至少選擇一個年齡層'),
  description: z.string().default(''),
  summary: z.string().trim().max(200, '簡短描述請控制在 200 字以內').optional(),
  tags: z.array(z.string().trim().min(1, '標籤不可為空').max(20, '單一標籤請在 20 字以內')).max(20, '標籤最多 20 個').optional(),
  seoTitle: z.string().trim().max(70, 'SEO 標題請控制在 70 字以內').optional(),
  seoDescription: z.string().trim().max(160, 'SEO 描述請控制在 160 字以內').optional(),
  material: z.string().default(''),
  careInstructions: z.string().default(''),
  sizeGuide: z.string().default(''),
  isNew: z.boolean().default(false),
  availableAt: z.string().datetime({ offset: true }).nullable().optional(),
  variants: z.array(variantSchema).min(1, '至少需要一個商品規格'),
}).strict().superRefine((product, context) => {
  const skus = new Set<string>()
  const combinations = new Set<string>()
  const ids = new Set<string>()

  product.variants.forEach((variant, index) => {
    if (variant.id && !variant.updatedAt) {
      context.addIssue({
        code: 'custom',
        message: '商品規格版本已過期，請重新載入',
        path: ['variants', index, 'updatedAt'],
      })
    }
    if (!variant.id && variant.updatedAt) {
      context.addIssue({
        code: 'custom',
        message: '新商品規格不可包含版本',
        path: ['variants', index, 'updatedAt'],
      })
    }

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

// Turns a product name into an ASCII slug fragment. Non-latin names (e.g. all
// Chinese) reduce to an empty string, which the caller handles with a fallback.
export function slugifyProductName(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// Builds a unique-enough slug when the admin leaves the field blank. The random
// token (derived from a UUID) keeps it collision-safe without a database probe.
export function generateProductSlug(name: string, uniqueToken: string): string {
  const base = slugifyProductName(name)
  const suffix = uniqueToken.replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase() || 'id'
  return base ? `${base}-${suffix}` : `mori-${suffix}`
}

export const scheduledSaleMessage = '預約開賣時間必須晚於現在'

// Returns an error message only when a NEW or CHANGED availableAt is not in the future.
// An unchanged, already-past date (e.g. a product whose scheduled launch has passed) is allowed,
// so editing such a product no longer fails validation.
export function availableAtError(
  availableAt: string | null | undefined,
  originalAvailableAt: string | null = null,
): string | null {
  if (!availableAt) return null
  if (originalAvailableAt && availableAt === originalAvailableAt) return null
  return new Date(availableAt).getTime() <= Date.now() ? scheduledSaleMessage : null
}

export type ProductVariantField = keyof ProductInput['variants'][number]
export type ProductVariantErrors = Array<Partial<Record<ProductVariantField, string[]>>>

export function getProductValidationErrors(error: z.ZodError) {
  const fieldErrors = error.flatten().fieldErrors
  const variantErrors: ProductVariantErrors = []

  for (const issue of error.issues) {
    if (issue.path[0] !== 'variants' || typeof issue.path[1] !== 'number') continue
    const index = issue.path[1]
    const field = issue.path[2]
    if (typeof field !== 'string') continue
    const row = variantErrors[index] ?? {}
    const key = field as ProductVariantField
    row[key] = [...(row[key] ?? []), issue.message]
    variantErrors[index] = row
  }

  return { fieldErrors, variantErrors }
}
