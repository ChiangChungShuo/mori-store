// Sorting and price-band definitions shared by the server queries and the
// client-side filter bar. Kept free of any server imports so the toolbar can
// use it without dragging the Supabase client into the browser bundle.

export type ProductSort = 'featured' | 'price_asc' | 'price_desc' | 'newest'
export type ProductPriceBand = 'under_500' | '500_1000' | '1000_1500' | 'over_1500'

/** Price bands, chosen to split this catalogue into roughly even groups. */
export const priceBands: Record<ProductPriceBand, { label: string; min: number; max: number }> = {
  under_500: { label: 'NT$500 以下', min: 0, max: 499 },
  '500_1000': { label: 'NT$500–1,000', min: 500, max: 1000 },
  '1000_1500': { label: 'NT$1,000–1,500', min: 1000, max: 1500 },
  over_1500: { label: 'NT$1,500 以上', min: 1500, max: Number.POSITIVE_INFINITY },
}

export const productSortOptions: Array<{ value: ProductSort; label: string }> = [
  { value: 'featured', label: '推薦排序' },
  { value: 'newest', label: '最新上架' },
  { value: 'price_asc', label: '價格低到高' },
  { value: 'price_desc', label: '價格高到低' },
]

/**
 * Cheapest variant of a product. Sold-out variants still count so the price on
 * the card, the price band and the sort order all agree with each other.
 */
export function lowestPrice(product: { variants: ReadonlyArray<{ price: number }> }) {
  return Math.min(...product.variants.map((variant) => variant.price))
}
