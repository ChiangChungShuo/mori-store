import 'server-only'

import type { CartVariantSnapshot } from '@/features/cart/refresh'
import type { CatalogProduct, ProductFilters } from '@/features/catalog/queries'

export const E2E_PRODUCT: CatalogProduct = {
  id: '00000000-0000-4000-8000-000000000000',
  slug: 'mori-organic-cotton-tee',
  name: '有機棉小樹 T 恤',
  description: '柔軟透氣的日常有機棉 T 恤。',
  category: '上衣',
  ageBands: ['3-5', '6-9'],
  material: '100% 有機棉',
  careInstructions: '建議冷水洗滌，低溫烘乾。',
  sizeGuide: '版型正常，請依孩子平常尺寸選購。',
  isNew: true,
  imageUrl: null,
  imageAlt: '有機棉小樹 T 恤',
  variants: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      sku: 'MORI-E2E-SAGE-100',
      color: '鼠尾草綠',
      size: '100',
      price: 680,
      compareAtPrice: 780,
      stock: 12,
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      sku: 'MORI-E2E-SAGE-120',
      color: '鼠尾草綠',
      size: '120',
      price: 680,
      compareAtPrice: 780,
      stock: 8,
    },
  ],
}

export function listE2EProducts(filters: ProductFilters) {
  const matches = (!filters.age || E2E_PRODUCT.ageBands.includes(filters.age))
    && (!filters.size || E2E_PRODUCT.variants.some((variant) => variant.size === filters.size))
    && (!filters.color || E2E_PRODUCT.variants.some((variant) => variant.color === filters.color))
    && (!filters.category || E2E_PRODUCT.category === filters.category)
    && (!filters.inStock || E2E_PRODUCT.variants.some((variant) => variant.stock > 0))
  return matches ? [E2E_PRODUCT] : []
}

export function getE2EProduct(slug: string) {
  return slug === E2E_PRODUCT.slug ? E2E_PRODUCT : null
}

export function getE2ECartVariants(variantIds: string[]): CartVariantSnapshot[] {
  return E2E_PRODUCT.variants
    .filter((variant) => variantIds.includes(variant.id))
    .map((variant) => ({
      variantId: variant.id,
      productSlug: E2E_PRODUCT.slug,
      name: E2E_PRODUCT.name,
      imageUrl: E2E_PRODUCT.imageUrl,
      color: variant.color,
      size: variant.size,
      unitPrice: variant.price,
      maxStock: variant.stock,
    }))
}

export const E2E_STOREFRONT_SETTINGS = {
  shippingFee: 60,
  freeShippingThreshold: 1500,
}
