import type { CartVariantSnapshot } from '@/features/cart/refresh'
import type { CatalogProduct, ProductFilters } from '@/features/catalog/queries'
import type { CheckoutVariant } from '@/features/checkout/service'
import { getE2EStore, type E2EStoreState } from '@/testing/e2e-store'

const TREE_TEE: CatalogProduct = {
  id: '00000000-0000-4000-8000-000000000000',
  slug: 'mori-organic-cotton-tee',
  name: '有機棉小樹 T 恤',
  description: '柔軟透氣的日常有機棉 T 恤。\n親膚有機棉織法，水洗後越穿越軟，適合每天穿搭與跑跳。',
  summary: '親膚有機棉、越洗越軟，孩子每天想穿的日常百搭上衣。',
  tags: ['有機棉', '日常', '親膚'],
  seoTitle: '有機棉小樹 T 恤 - mori 童裝',
  seoDescription: '100% 有機棉、親膚透氣的兒童日常 T 恤，柔軟耐穿好活動；台灣本島超商取貨、滿額免運。',
  category: '上衣',
  series: [],
  ageBands: ['3-6', '6-12'],
  material: '100% 有機棉',
  careInstructions: '建議冷水洗滌，低溫烘乾。',
  sizeGuide: '版型正常，請依孩子平常尺寸選購。',
  isNew: true,
  imageUrl: '/images/products/mori-tree-tee.jpg',
  imageAlt: '鼠尾草綠有機棉小樹 T 恤',
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

const CLOUD_ROMPER: CatalogProduct = {
  id: '00000000-0000-4000-8000-000000000100',
  slug: 'mori-cloud-romper',
  name: '雲朵包屁衣',
  description: '親膚棉紗搭配方便穿脫的肩領與底部按扣。',
  category: '幼兒服',
  series: [],
  ageBands: ['0-3'],
  material: '100% 有機棉紗',
  careInstructions: '裝洗衣袋冷水柔洗，自然晾乾。',
  sizeGuide: '包覆感寬鬆，可依月齡選擇。',
  isNew: true,
  imageUrl: '/images/products/mori-cloud-romper.jpg',
  imageAlt: '米白色雲朵包屁衣',
  variants: [
    {
      id: '00000000-0000-4000-8000-000000000101',
      sku: 'MORI-CLOUD-CREAM-70',
      color: '雲朵米',
      size: '70',
      price: 580,
      compareAtPrice: null,
      stock: 10,
    },
    {
      id: '00000000-0000-4000-8000-000000000102',
      sku: 'MORI-CLOUD-CREAM-80',
      color: '雲朵米',
      size: '80',
      price: 580,
      compareAtPrice: null,
      stock: 7,
    },
  ],
}

const EVERYDAY_PANTS: CatalogProduct = {
  id: '00000000-0000-4000-8000-000000000200',
  slug: 'mori-everyday-pants',
  name: '自在長褲',
  description: '柔軟挺度剛好的寬鬆長褲，適合每天活動。',
  category: '褲裝',
  series: [],
  ageBands: ['3-6', '6-12'],
  material: '棉 70%、麻 30%',
  careInstructions: '冷水反面洗滌，陰涼處吊掛晾乾。',
  sizeGuide: '寬鬆版型，腰圍有彈性。',
  isNew: false,
  imageUrl: '/images/products/mori-everyday-pants.jpg',
  imageAlt: '深海軍藍自在長褲',
  variants: [
    {
      id: '00000000-0000-4000-8000-000000000201',
      sku: 'MORI-PANTS-NAVY-110',
      color: '深海軍藍',
      size: '110',
      price: 780,
      compareAtPrice: null,
      stock: 9,
    },
    {
      id: '00000000-0000-4000-8000-000000000202',
      sku: 'MORI-PANTS-NAVY-130',
      color: '深海軍藍',
      size: '130',
      price: 780,
      compareAtPrice: null,
      stock: 6,
    },
    {
      id: '00000000-0000-4000-8000-000000000203',
      sku: 'MORI-PANTS-NAVY-150',
      color: '深海軍藍',
      size: '150',
      price: 820,
      compareAtPrice: null,
      stock: 4,
    },
  ],
}

const MEADOW_DRESS: CatalogProduct = {
  id: '00000000-0000-4000-8000-000000000300',
  slug: 'mori-meadow-dress',
  name: '花野洋裝',
  description: '細緻小花布搭配自然裙襬，日常與出遊都舒適。',
  category: '洋裝',
  series: [],
  ageBands: ['3-6', '6-12'],
  material: '100% 棉',
  careInstructions: '冷水柔洗，避免長時間浸泡。',
  sizeGuide: '胸圍略寬鬆，裙長落在膝下。',
  isNew: true,
  imageUrl: '/images/products/mori-meadow-dress.jpg',
  imageAlt: '森林綠小花花野洋裝',
  variants: [
    {
      id: '00000000-0000-4000-8000-000000000301',
      sku: 'MORI-DRESS-MEADOW-100',
      color: '花野綠',
      size: '100',
      price: 980,
      compareAtPrice: 1080,
      stock: 8,
    },
    {
      id: '00000000-0000-4000-8000-000000000302',
      sku: 'MORI-DRESS-MEADOW-120',
      color: '花野綠',
      size: '120',
      price: 980,
      compareAtPrice: 1080,
      stock: 5,
    },
  ],
}

const WIND_JACKET: CatalogProduct = {
  id: '00000000-0000-4000-8000-000000000400',
  slug: 'mori-wind-jacket',
  name: '輕風防風外套',
  description: '輕薄防潑水布料，應付早晚涼風與短暫細雨。',
  category: '外套',
  series: [],
  ageBands: ['6-12'],
  material: '再生尼龍 100%',
  careInstructions: '冷水手洗，不可烘乾與熨燙。',
  sizeGuide: '可容納薄針織內搭，建議依身高選購。',
  isNew: true,
  imageUrl: '/images/products/mori-wind-jacket.jpg',
  imageAlt: '苔蘚綠輕風防風外套',
  variants: [
    {
      id: '00000000-0000-4000-8000-000000000401',
      sku: 'MORI-JACKET-MOSS-130',
      color: '苔蘚綠',
      size: '130',
      price: 1280,
      compareAtPrice: null,
      stock: 6,
    },
    {
      id: '00000000-0000-4000-8000-000000000402',
      sku: 'MORI-JACKET-MOSS-150',
      color: '苔蘚綠',
      size: '150',
      price: 1280,
      compareAtPrice: null,
      stock: 3,
    },
  ],
}

const KNIT_VEST: CatalogProduct = {
  id: '00000000-0000-4000-8000-000000000500',
  slug: 'mori-knit-vest',
  name: '燕麥針織背心',
  description: '柔軟棉質針織，換季時方便疊穿增加暖度。',
  category: '上衣',
  series: [],
  ageBands: ['0-3', '3-6'],
  material: '100% 精梳棉',
  careInstructions: '冷水手洗，平放晾乾。',
  sizeGuide: '肩線合身，內搭襯衫仍保有活動空間。',
  isNew: false,
  imageUrl: '/images/products/mori-knit-vest.jpg',
  imageAlt: '燕麥色棉質針織背心',
  variants: [
    {
      id: '00000000-0000-4000-8000-000000000501',
      sku: 'MORI-VEST-OAT-80',
      color: '燕麥色',
      size: '80',
      price: 680,
      compareAtPrice: null,
      stock: 11,
    },
    {
      id: '00000000-0000-4000-8000-000000000502',
      sku: 'MORI-VEST-OAT-100',
      color: '燕麥色',
      size: '100',
      price: 720,
      compareAtPrice: null,
      stock: 7,
    },
  ],
}

const POCKET_SHIRT: CatalogProduct = {
  id: '00000000-0000-4000-8000-000000000600',
  slug: 'mori-pocket-shirt',
  name: '陶土口袋襯衫',
  description: '柔軟斜紋布襯衫，胸前口袋收進實用小細節。',
  category: '上衣',
  series: [],
  ageBands: ['6-12'],
  material: '100% 棉',
  careInstructions: '反面冷水洗滌，低溫整燙。',
  sizeGuide: '微寬鬆版型，可單穿或作為薄外搭。',
  isNew: false,
  imageUrl: '/images/products/mori-pocket-shirt.jpg',
  imageAlt: '陶土色長袖口袋襯衫',
  variants: [
    {
      id: '00000000-0000-4000-8000-000000000601',
      sku: 'MORI-SHIRT-CLAY-130',
      color: '陶土棕',
      size: '130',
      price: 880,
      compareAtPrice: null,
      stock: 7,
    },
    {
      id: '00000000-0000-4000-8000-000000000602',
      sku: 'MORI-SHIRT-CLAY-150',
      color: '陶土棕',
      size: '150',
      price: 880,
      compareAtPrice: null,
      stock: 5,
    },
  ],
}

const DENIM_OVERALLS: CatalogProduct = {
  id: '00000000-0000-4000-8000-000000000700',
  slug: 'mori-denim-overalls',
  name: '水洗丹寧吊帶褲',
  description: '柔軟水洗丹寧與可調式肩帶，活動自在又耐穿。',
  category: '褲裝',
  series: [],
  ageBands: ['0-3', '3-6'],
  material: '棉 98%、彈性纖維 2%',
  careInstructions: '與相近色衣物反面冷水洗滌。',
  sizeGuide: '肩帶可調，褲管可反摺穿著。',
  isNew: true,
  imageUrl: '/images/products/mori-denim-overalls.jpg',
  imageAlt: '水洗藍兒童丹寧吊帶褲',
  variants: [
    {
      id: '00000000-0000-4000-8000-000000000701',
      sku: 'MORI-OVERALLS-DENIM-80',
      color: '水洗藍',
      size: '80',
      price: 1080,
      compareAtPrice: null,
      stock: 8,
    },
    {
      id: '00000000-0000-4000-8000-000000000702',
      sku: 'MORI-OVERALLS-DENIM-100',
      color: '水洗藍',
      size: '100',
      price: 1080,
      compareAtPrice: null,
      stock: 6,
    },
  ],
}

export const E2E_PRODUCTS: readonly CatalogProduct[] = [
  TREE_TEE,
  CLOUD_ROMPER,
  EVERYDAY_PANTS,
  MEADOW_DRESS,
  WIND_JACKET,
  KNIT_VEST,
  POCKET_SHIRT,
  DENIM_OVERALLS,
]

export const E2E_PRODUCT = E2E_PRODUCTS[0]

export function getMutableE2EProducts(store: E2EStoreState = getE2EStore()) {
  if (store.products.length === 0) {
    store.products = structuredClone([...E2E_PRODUCTS])
    store.publishedProductIds = new Set(E2E_PRODUCTS.map((product) => product.id))
    for (const product of store.products) {
      for (const variant of product.variants) {
        if (!store.variantCosts.has(variant.id)) store.variantCosts.set(variant.id, Math.round(variant.price * 0.45))
      }
    }
  }
  return store.products
}

function matchesProduct(product: CatalogProduct, filters: ProductFilters) {
  const query = filters.q?.toLocaleLowerCase('zh-Hant')
  const searchable = [
    product.name,
    product.description,
    product.category,
    product.material,
    ...product.variants.flatMap((variant) => [variant.color, variant.size, variant.sku]),
  ].join(' ').toLocaleLowerCase('zh-Hant')
  return (!query || searchable.includes(query))
    && (!filters.age || product.ageBands.includes(filters.age))
    && (!filters.size || product.variants.some((variant) => variant.size === filters.size))
    && (!filters.color || product.variants.some((variant) => variant.color.includes(filters.color!)))
    && (!filters.category || product.category === filters.category)
    && (!filters.series || product.series.some((series) => (
      series.categoryName === filters.category && series.name === filters.series
    )))
    && (!filters.inStock || product.variants.some((variant) => variant.stock > 0))
}

function toCartSnapshot(
  product: CatalogProduct,
  variant: CatalogProduct['variants'][number],
): CartVariantSnapshot {
  return {
    variantId: variant.id,
    productSlug: product.slug,
    name: product.name,
    imageUrl: product.imageUrl,
    color: variant.color,
    size: variant.size,
    unitPrice: variant.price,
    maxStock: variant.stock,
  }
}

export function listE2EProducts(filters: ProductFilters) {
  const store = getE2EStore()
  return getMutableE2EProducts()
    .map((product) => attachProductSeries(product, store))
    .map((product) => {
      const quantityPrices = store.quantityPrices.get(product.slug)
      return quantityPrices?.length ? { ...product, quantityPrices } : product
    })
    .filter((product) => (
      store.publishedProductIds.has(product.id) && matchesProduct(product, filters)
    ))
}

export function getE2EProduct(slug: string) {
  const store = getE2EStore()
  return getMutableE2EProducts().map((product) => attachProductSeries(product, store)).find((product) => (
    store.publishedProductIds.has(product.id) && product.slug === slug
  )) ?? null
}

function attachProductSeries(product: CatalogProduct, store: E2EStoreState) {
  const seriesIds = store.productSeriesProducts
    .filter((assignment) => assignment.productId === product.id)
    .map((assignment) => assignment.seriesId)
  return {
    ...product,
    series: store.productSeries
      .filter((series) => seriesIds.includes(series.id))
      .sort((first, second) => first.position - second.position),
  }
}

export function getE2ECartVariants(variantIds: string[]): CartVariantSnapshot[] {
  const store = getE2EStore()
  return getMutableE2EProducts().filter((product) => store.publishedProductIds.has(product.id) && (!product.availableAt || new Date(product.availableAt) <= new Date())).flatMap((product) => product.variants
    .filter((variant) => variantIds.includes(variant.id))
    .map((variant) => toCartSnapshot(product, variant)))
}

export function getE2EVariants(variantIds: string[], store: E2EStoreState = getE2EStore()): CheckoutVariant[] {
  return getMutableE2EProducts(store).filter((product) => store.publishedProductIds.has(product.id) && (!product.availableAt || new Date(product.availableAt) <= new Date())).flatMap((product) => product.variants
    .filter((variant) => variantIds.includes(variant.id))
    .map((variant) => ({
      id: variant.id,
      productName: product.name,
      sku: variant.sku,
      color: variant.color,
      size: variant.size,
      price: variant.price,
      stock: variant.stock,
      isPublished: true,
      imageUrl: product.imageUrl,
      productSlug: product.slug,
      quantityPrices: store.quantityPrices.get(product.slug) ?? [],
    })))
}

export function getE2EQuantityPriceMap() {
  const store = getE2EStore()
  const map: Record<string, Array<{ quantity: number; bundlePrice: number }>> = {}
  for (const product of getMutableE2EProducts(store)) {
    if (!store.publishedProductIds.has(product.id)) continue
    const tiers = store.quantityPrices.get(product.slug)
    if (tiers?.length) map[product.slug] = tiers
  }
  return map
}

export const E2E_STOREFRONT_SETTINGS = {
  shippingFee: 60,
  freeShippingThreshold: 1500,
}
