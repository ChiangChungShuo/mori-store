/**
 * Product quantity ("buy N for NT$X") pricing.
 *
 * Tiers belong to a product, so colours and sizes of the same product mix
 * freely: three different sizes of one tee still hit the "任選 3 件" tier. The
 * shopper always pays the cheapest reachable combination, and never more than
 * the plain unit-price total.
 *
 * Kept dependency-free so the storefront preview and the server-side checkout
 * run the exact same arithmetic.
 */

export type QuantityPriceTier = {
  quantity: number
  bundlePrice: number
}

export type BundleLine = {
  unitPrice: number
  quantity: number
}

export type AppliedTier = QuantityPriceTier & {
  /** How many times this tier is used in the winning combination. */
  times: number
}

export type BundlePricing = {
  /** Sum of unit prices — what the shopper would pay with no tiers. */
  originalSubtotal: number
  /** What the shopper actually pays for these lines. */
  discountedSubtotal: number
  /** originalSubtotal - discountedSubtotal, never negative. */
  discount: number
  appliedTiers: AppliedTier[]
  /** Units left paying their own unit price. */
  remainingUnits: number
}

const EMPTY: BundlePricing = {
  originalSubtotal: 0,
  discountedSubtotal: 0,
  discount: 0,
  appliedTiers: [],
  remainingUnits: 0,
}

function isUsableTier(tier: QuantityPriceTier) {
  return Number.isInteger(tier.quantity)
    && tier.quantity >= 2
    && Number.isFinite(tier.bundlePrice)
    && tier.bundlePrice >= 0
}

/**
 * Drops unusable tiers and keeps the cheapest price per quantity, so a
 * duplicated or mistyped tier can never make a bundle more expensive.
 */
export function normalizeQuantityTiers(tiers: QuantityPriceTier[]): QuantityPriceTier[] {
  const cheapestByQuantity = new Map<number, number>()
  for (const tier of tiers) {
    if (!isUsableTier(tier)) continue
    const price = Math.round(tier.bundlePrice)
    const existing = cheapestByQuantity.get(tier.quantity)
    if (existing === undefined || price < existing) {
      cheapestByQuantity.set(tier.quantity, price)
    }
  }

  return [...cheapestByQuantity.entries()]
    .map(([quantity, bundlePrice]) => ({ quantity, bundlePrice }))
    .sort((a, b) => a.quantity - b.quantity)
}

/**
 * Prices one product's cart lines against its tiers.
 *
 * Any k units covered by tiers cost the same no matter which units they are, so
 * the cheapest answer always puts the k *most expensive* units into bundles and
 * leaves the cheapest ones at unit price. That reduces the search to "how many
 * units to bundle", solved with an exact-cover unbounded knapsack over k.
 */
export function priceProductBundle(
  lines: BundleLine[],
  tiers: QuantityPriceTier[],
): BundlePricing {
  const unitPrices: number[] = []
  for (const line of lines) {
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) continue
    if (!Number.isInteger(line.quantity) || line.quantity < 1) continue
    for (let index = 0; index < line.quantity; index += 1) {
      unitPrices.push(Math.round(line.unitPrice))
    }
  }
  if (!unitPrices.length) return EMPTY

  const originalSubtotal = unitPrices.reduce((total, price) => total + price, 0)
  const totalUnits = unitPrices.length
  const usableTiers = normalizeQuantityTiers(tiers).filter((tier) => tier.quantity <= totalUnits)
  if (!usableTiers.length) {
    return {
      originalSubtotal,
      discountedSubtotal: originalSubtotal,
      discount: 0,
      appliedTiers: [],
      remainingUnits: totalUnits,
    }
  }

  // Most expensive first, so the first k entries are the ones worth bundling.
  const descending = [...unitPrices].sort((a, b) => b - a)
  const bundledUnitsValue: number[] = [0]
  for (const price of descending) {
    bundledUnitsValue.push(bundledUnitsValue[bundledUnitsValue.length - 1] + price)
  }

  // bundleCost[k] = cheapest way to cover exactly k units with tiers.
  const bundleCost = new Array<number>(totalUnits + 1).fill(Number.POSITIVE_INFINITY)
  const chosenTier = new Array<number>(totalUnits + 1).fill(-1)
  bundleCost[0] = 0
  for (let covered = 1; covered <= totalUnits; covered += 1) {
    for (let index = 0; index < usableTiers.length; index += 1) {
      const tier = usableTiers[index]
      if (tier.quantity > covered) continue
      const previous = bundleCost[covered - tier.quantity]
      if (previous === Number.POSITIVE_INFINITY) continue
      const candidate = previous + tier.bundlePrice
      if (candidate < bundleCost[covered]) {
        bundleCost[covered] = candidate
        chosenTier[covered] = index
      }
    }
  }

  let bestCovered = 0
  let bestTotal = originalSubtotal
  for (let covered = 1; covered <= totalUnits; covered += 1) {
    if (bundleCost[covered] === Number.POSITIVE_INFINITY) continue
    // Units outside the bundles are the cheapest ones.
    const total = bundleCost[covered] + (originalSubtotal - bundledUnitsValue[covered])
    if (total < bestTotal) {
      bestTotal = total
      bestCovered = covered
    }
  }

  const timesByQuantity = new Map<number, number>()
  for (let covered = bestCovered; covered > 0;) {
    const tier = usableTiers[chosenTier[covered]]
    timesByQuantity.set(tier.quantity, (timesByQuantity.get(tier.quantity) ?? 0) + 1)
    covered -= tier.quantity
  }

  const appliedTiers = [...timesByQuantity.entries()]
    .map(([quantity, times]) => ({
      quantity,
      bundlePrice: usableTiers.find((tier) => tier.quantity === quantity)!.bundlePrice,
      times,
    }))
    .sort((a, b) => b.quantity - a.quantity)

  return {
    originalSubtotal,
    discountedSubtotal: bestTotal,
    discount: originalSubtotal - bestTotal,
    appliedTiers,
    remainingUnits: totalUnits - bestCovered,
  }
}

export type BundleCartLine = BundleLine & {
  /** Groups lines that share tiers — colours and sizes of one product. */
  productKey: string
}

export type CartBundlePricing = {
  discount: number
  byProduct: Map<string, BundlePricing>
}

/** Prices a whole cart, grouping lines by product before applying tiers. */
export function calculateBundleDiscounts(
  lines: BundleCartLine[],
  tiersByProduct: Record<string, QuantityPriceTier[]> | Map<string, QuantityPriceTier[]>,
): CartBundlePricing {
  const lookup = tiersByProduct instanceof Map
    ? tiersByProduct
    : new Map(Object.entries(tiersByProduct))

  const linesByProduct = new Map<string, BundleLine[]>()
  for (const line of lines) {
    if (!lookup.get(line.productKey)?.length) continue
    const existing = linesByProduct.get(line.productKey)
    if (existing) existing.push(line)
    else linesByProduct.set(line.productKey, [line])
  }

  const byProduct = new Map<string, BundlePricing>()
  let discount = 0
  for (const [productKey, productLines] of linesByProduct) {
    const pricing = priceProductBundle(productLines, lookup.get(productKey) ?? [])
    if (pricing.discount <= 0) continue
    byProduct.set(productKey, pricing)
    discount += pricing.discount
  }

  return { discount, byProduct }
}

/**
 * Product-page copy for one tier, e.g. "任選 2 件 NT$1,000（省 NT$180）".
 * `unitPrice` is the cheapest published price, so the saving is never overstated.
 */
export function describeQuantityTier(tier: QuantityPriceTier, unitPrice: number) {
  const saving = Math.max(0, unitPrice * tier.quantity - tier.bundlePrice)
  const perUnit = Math.round(tier.bundlePrice / tier.quantity)
  return {
    quantity: tier.quantity,
    bundlePrice: tier.bundlePrice,
    saving,
    perUnit,
    label: `任選 ${tier.quantity} 件`,
  }
}
