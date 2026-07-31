import type { QuantityPriceTier } from '@/features/cart/bundle-pricing'
import { normalizeQuantityTiers } from '@/features/cart/bundle-pricing'
import { isE2EMode } from '@/testing/e2e-mode'

/** slug → the product's quantity tiers. */
export type QuantityPriceMap = Record<string, QuantityPriceTier[]>

/**
 * Every published product that has quantity tiers, keyed by slug.
 *
 * Loaded once per storefront render and handed to the cart so the drawer and
 * the cart page price bundles without a client round-trip. Tiered products are
 * a small subset, so this stays a cheap query.
 */
export async function getQuantityPriceMap(): Promise<QuantityPriceMap> {
  if (isE2EMode()) {
    const { getE2EQuantityPriceMap } = await import('@/testing/e2e-storefront-fixtures')
    return getE2EQuantityPriceMap()
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL
    || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return {}
  }

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('product_quantity_prices')
      .select('quantity, bundle_price, products!inner(slug, is_published)')
      .eq('products.is_published', true)
    if (error) throw error

    const tiersBySlug: Record<string, QuantityPriceTier[]> = {}
    for (const row of (data ?? []) as unknown as Array<{
      quantity: number
      bundle_price: number
      products: { slug: string }
    }>) {
      const slug = row.products.slug
      tiersBySlug[slug] ??= []
      tiersBySlug[slug].push({ quantity: row.quantity, bundlePrice: row.bundle_price })
    }

    for (const slug of Object.keys(tiersBySlug)) {
      tiersBySlug[slug] = normalizeQuantityTiers(tiersBySlug[slug])
    }
    return tiersBySlug
  } catch {
    // Bundle pricing is an enhancement — never take the storefront down for it.
    return {}
  }
}

/** Tiers for one product, used by the product detail page. */
export async function getProductQuantityPrices(slug: string): Promise<QuantityPriceTier[]> {
  const map = await getQuantityPriceMap()
  return map[slug] ?? []
}
