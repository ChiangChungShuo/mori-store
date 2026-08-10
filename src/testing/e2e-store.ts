import type { PaymentAttemptInsert } from '@/features/checkout/service'
import type { PaymentAttemptStatus } from '@/features/checkout/types'
import type { PaymentMethod } from '@/features/checkout/types'
import type { OrderStatus, StoreChain } from '@/types/store'
import type { StorefrontEvent } from '@/features/analytics/insights'
import type { CatalogProduct } from '@/features/catalog/queries'
import type { BannerSlide } from '@/features/storefront/banner-settings'
import { defaultProductCategories } from '@/features/catalog/category-defaults'
import { defaultMaterialPresets, defaultCarePresets, defaultSizePresets } from '@/features/catalog/content-preset-defaults'
import type { ProductSeries } from '@/features/catalog/product-series'

export type E2EUser = {
  id: string
  email: string
  role: 'customer' | 'admin'
  displayName: string | null
  phone: string | null
  termsAcceptedAt: string | null
  marketingConsentAt: string | null
  passwordSalt: string
  passwordHash: string
}

export type E2EPendingSignup = {
  email: string
  displayName: string
  phone: string
  termsAcceptedAt: string
  marketingConsentAt: string | null
  code: '123456'
  requestedAt: string
  verifiedAt: string | null
}

export type E2ESession = {
  userId: string
  createdAt: string
}

export type E2EAttempt = PaymentAttemptInsert & {
  id: string
  status: PaymentAttemptStatus
  orderNumber: string | null
}

export type E2EOrder = {
  id: string
  orderNumber: string
  userId: string | null
  email: string
  recipientName: string
  recipientPhone: string
  storeChain: StoreChain
  storeId: string
  storeName: string
  customerNote: string
  merchantReply: string
  paymentMethod: PaymentMethod
  bankTransferLastFive?: string | null
  bankTransferSubmittedAt?: string | null
  subtotal: number
  shippingFee: number
  total: number
  status: OrderStatus
  createdAt: string
  items: Array<{
    id: string
    variantId: string
    productName: string
    sku: string
    color: string
    size: string
    unitPrice: number
    quantity: number
  }>
  payment: {
    status: string
    providerReference: string | null
    paidAt: string | null
  } | null
}

export type E2EStoreState = {
  users: Map<string, E2EUser>
  pendingSignups: Map<string, E2EPendingSignup>
  sessions: Map<string, E2ESession>
  attempts: Map<string, E2EAttempt>
  orders: Map<string, E2EOrder>
  events: Array<StorefrontEvent & { createdAt: string }>
  settings: {
    shippingFee: number
    freeShippingThreshold: number | null
    contactEmail: string
    siteTitle?: string
    siteDescription?: string
    siteKeywords?: string[]
    googleAnalyticsId?: string | null
  }
  bannerSlides: BannerSlide[]
  productCategories: string[]
  productSeries: ProductSeries[]
  productSeriesProducts: Array<{ productId: string; seriesId: string }>
  contentPresets: { material: string[]; care: string[]; size: string[]; series: string[] }
  productContentDefaults: { material: string; careInstructions: string; sizeGuide: string } | null
  welcomeGift: { enabled: boolean; code: string; amount: number; minimumSpend: number } | null
  memberCredits: Array<{ userId: string; amount: number; reason: 'signup_gift' | 'order' | 'manual'; orderId: string | null; createdAt: string }>
  productDrafts: Array<{ id: string; label: string; data: unknown; updatedAt: string }>
  customerPhotos: Array<{ id: string; productId: string | null; imageUrl: string; caption: string }>
  productReviews: Array<{
    id: string
    productId: string
    userId: string
    rating: number
    body: string
    createdAt: string
    updatedAt: string
  }>
  restockRequests: Array<{
    id: string
    productId: string
    email: string
    notifiedAt: string | null
    createdAt: string
  }>
  products: CatalogProduct[]
  /** Product slug → quantity tiers, mirroring product_quantity_prices. */
  quantityPrices: Map<string, Array<{ quantity: number; bundlePrice: number }>>
  variantCosts: Map<string, number>
  publishedProductIds: Set<string>
  uploadedProductImages: Map<string, string>
  memberProfiles: Map<string, {
    tier: 'seed' | 'forest' | 'canopy'
    points: number
    discountPercent: number
  }>
  promotions: Array<{
    id: string
    name: string
    type: 'coupon' | 'threshold_gift'
    code: string
    conditionValue: number
    rewardValue: number
    giftName: string
    active: boolean
    startsAt?: string | null
    endsAt?: string | null
    usageLimit?: 'unlimited' | 'once_total' | 'once_per_account'
  }>
  promotionRedemptions: Array<{
    promotionId: string
    code: string
    email: string
    orderNumber: string | null
  }>
  abandonedCartReminder: {
    enabled: boolean
    delayHours: number
    subject: string
  }
}

const ADMIN_USER: E2EUser = {
  id: 'admin',
  email: 'admin@mori.tw',
  role: 'admin',
  displayName: 'mori 老闆',
  phone: null,
  termsAcceptedAt: null,
  marketingConsentAt: null,
  passwordSalt: 'mori-demo-admin',
  passwordHash: '244e97e542a826a86f8381b04b4deaa662786495e4ec1b7be1a44dd275aafcef',
}

const SEED_ORDER: E2EOrder = {
  id: '00000000-0000-4000-8000-000000001001',
  orderNumber: 'MORI-DEMO-1001',
  userId: null,
  email: 'parent@example.com',
  recipientName: '王小美',
  recipientPhone: '0912345678',
  storeChain: 'seven_eleven',
  storeId: '123456',
  storeName: '台北門市',
  customerNote: '到貨後請以簡訊通知，謝謝。',
  merchantReply: '已收到留言，出貨前會再次確認包裝。',
  paymentMethod: 'bank_transfer',
  bankTransferLastFive: '54321',
  bankTransferSubmittedAt: '2026-07-20T02:10:00.000Z',
  subtotal: 680,
  shippingFee: 60,
  total: 740,
  status: 'paid',
  createdAt: '2026-07-20T02:00:00.000Z',
  items: [{
    id: '00000000-0000-4000-8000-000000001002',
    variantId: '00000000-0000-4000-8000-000000000001',
    productName: '有機棉小樹 T 恤',
    sku: 'MORI-E2E-SAGE-100',
    color: '鼠尾草綠',
    size: '100',
    unitPrice: 680,
    quantity: 1,
  }],
  payment: {
    status: 'paid',
    providerReference: 'mori-demo-seed',
    paidAt: '2026-07-20T02:00:00.000Z',
  },
}

const fixtureGlobal = globalThis as typeof globalThis & {
  __moriE2EStore?: E2EStoreState
}

export function createE2EStore(): E2EStoreState {
  return {
    users: new Map([[ADMIN_USER.id, { ...ADMIN_USER }]]),
    pendingSignups: new Map(),
    sessions: new Map(),
    attempts: new Map(),
    orders: new Map([[SEED_ORDER.orderNumber, structuredClone(SEED_ORDER)]]),
    events: [
      { sessionId: 'seed-buyer', type: 'product_view', productName: '有機棉小樹 T 恤', path: '/products/mori-organic-cotton-tee', createdAt: '2026-07-20T01:20:00.000Z' },
      { sessionId: 'seed-buyer', type: 'add_to_cart', productName: '有機棉小樹 T 恤', path: '/products/mori-organic-cotton-tee', createdAt: '2026-07-20T01:25:00.000Z' },
      { sessionId: 'seed-buyer', type: 'purchase', productName: null, path: '/order-complete/MORI-DEMO-1001', createdAt: '2026-07-20T02:00:00.000Z' },
      { sessionId: 'seed-window-shopper', type: 'product_view', productName: '花野洋裝', path: '/products/mori-meadow-dress', createdAt: '2026-07-20T03:00:00.000Z' },
      { sessionId: 'seed-window-shopper', type: 'add_to_cart', productName: '花野洋裝', path: '/products/mori-meadow-dress', createdAt: '2026-07-20T03:05:00.000Z' },
    ],
    settings: {
      shippingFee: 60,
      freeShippingThreshold: 1500,
      contactEmail: 'hello@mori.tw',
    },
    bannerSlides: [
      {
        imageUrl: '/images/mori-hero.jpg',
        imageAlt: '兩位穿著舒適童裝的孩子在庭院散步',
        eyebrow: 'mori summer edit · 2026',
        title: '小小日常，\n自在長大。',
        body: '替 0–12 歲孩子挑選柔軟、好活動、每天都願意穿的衣服。',
        buttonLabel: '選購本週新品',
        buttonHref: '/#new',
      },
      {
        imageUrl: '/images/products/mori-meadow-dress.jpg',
        imageAlt: '森林綠小花花野洋裝',
        eyebrow: 'weekend in green',
        title: '把舒服，\n穿進週末。',
        body: '親膚材質與自在版型，陪孩子從日常一路玩到旅行。',
        buttonLabel: '看看本週選品',
        buttonHref: '/products',
      },
    ],
    productCategories: [...defaultProductCategories],
    productSeries: [
      { id: '10000000-0000-4000-8000-000000000001', categoryName: '上衣', name: 'Mori flora 漫花系列', position: 0 },
      { id: '10000000-0000-4000-8000-000000000002', categoryName: '上衣', name: 'Mori forest 森林系列', position: 1 },
      { id: '10000000-0000-4000-8000-000000000003', categoryName: '褲裝', name: 'Mori daily 日常系列', position: 0 },
    ],
    productSeriesProducts: [
      { productId: '00000000-0000-4000-8000-000000000000', seriesId: '10000000-0000-4000-8000-000000000001' },
      { productId: '00000000-0000-4000-8000-000000000500', seriesId: '10000000-0000-4000-8000-000000000001' },
      { productId: '00000000-0000-4000-8000-000000000600', seriesId: '10000000-0000-4000-8000-000000000002' },
      { productId: '00000000-0000-4000-8000-000000000200', seriesId: '10000000-0000-4000-8000-000000000003' },
    ],
    contentPresets: { material: [...defaultMaterialPresets], care: [...defaultCarePresets], size: [...defaultSizePresets], series: [] },
    productContentDefaults: null,
    welcomeGift: null,
    memberCredits: [],
    productDrafts: [],
    customerPhotos: [],
    productReviews: [],
    restockRequests: [],
    products: [],
    // One tiered product so fixture/E2E runs exercise bundle pricing. Kept off
    // the tee, whose totals other specs assert.
    quantityPrices: new Map([['mori-cloud-romper', [
      { quantity: 2, bundlePrice: 1000 },
      { quantity: 3, bundlePrice: 1400 },
    ]]]),
    variantCosts: new Map(),
    publishedProductIds: new Set(),
    uploadedProductImages: new Map(),
    memberProfiles: new Map([['parent@example.com', {
      tier: 'forest',
      points: 74,
      discountPercent: 3,
    }]]),
    promotions: [{
      id: '00000000-0000-4000-8000-000000009001',
      name: '新會員歡迎禮',
      type: 'coupon',
      code: 'HELLOMORI',
      conditionValue: 1000,
      rewardValue: 100,
      giftName: '',
      active: true,
      startsAt: null,
      endsAt: null,
      usageLimit: 'unlimited',
    }],
    promotionRedemptions: [],
    abandonedCartReminder: {
      enabled: false,
      delayHours: 24,
      subject: '你在 mori 的購物車還在等你',
    },
  }
}

export function getE2EStore() {
  fixtureGlobal.__moriE2EStore ??= createE2EStore()
  fixtureGlobal.__moriE2EStore.pendingSignups ??= new Map()
  fixtureGlobal.__moriE2EStore.events ??= createE2EStore().events
  fixtureGlobal.__moriE2EStore.settings ??= createE2EStore().settings
  fixtureGlobal.__moriE2EStore.products ??= []
  fixtureGlobal.__moriE2EStore.customerPhotos ??= []
  fixtureGlobal.__moriE2EStore.productCategories ??= [...defaultProductCategories]
  fixtureGlobal.__moriE2EStore.productSeries ??= createE2EStore().productSeries
  fixtureGlobal.__moriE2EStore.productSeriesProducts ??= createE2EStore().productSeriesProducts
  fixtureGlobal.__moriE2EStore.contentPresets ??= { material: [...defaultMaterialPresets], care: [...defaultCarePresets], size: [...defaultSizePresets], series: [] }
  fixtureGlobal.__moriE2EStore.contentPresets.series ??= []
  fixtureGlobal.__moriE2EStore.productContentDefaults ??= null
  fixtureGlobal.__moriE2EStore.welcomeGift ??= null
  fixtureGlobal.__moriE2EStore.memberCredits ??= []
  fixtureGlobal.__moriE2EStore.productDrafts ??= []
  fixtureGlobal.__moriE2EStore.promotionRedemptions ??= []
  fixtureGlobal.__moriE2EStore.variantCosts ??= new Map()
  fixtureGlobal.__moriE2EStore.publishedProductIds ??= new Set()
  fixtureGlobal.__moriE2EStore.uploadedProductImages ??= new Map()
  fixtureGlobal.__moriE2EStore.memberProfiles ??= new Map()
  fixtureGlobal.__moriE2EStore.promotions ??= []
  fixtureGlobal.__moriE2EStore.abandonedCartReminder ??= createE2EStore().abandonedCartReminder
  for (const user of fixtureGlobal.__moriE2EStore.users.values()) {
    user.phone ??= null
    user.termsAcceptedAt ??= null
  }
  for (const order of fixtureGlobal.__moriE2EStore.orders.values()) {
    order.merchantReply ??= ''
    order.bankTransferLastFive ??= null
    order.bankTransferSubmittedAt ??= null
  }
  return fixtureGlobal.__moriE2EStore
}
