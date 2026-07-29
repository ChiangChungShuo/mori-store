import type { CatalogProduct } from './queries'

export type ProductAvailability = 'available' | 'sold_out' | 'coming_soon'

export function getProductAvailability(
  product: Pick<CatalogProduct, 'availableAt' | 'variants'>,
  now = new Date(),
): ProductAvailability {
  if (product.availableAt && new Date(product.availableAt) > now) return 'coming_soon'
  if (!product.variants.some((variant) => variant.stock > 0)) return 'sold_out'
  return 'available'
}
