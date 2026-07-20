import type { PaymentAttemptInsert } from '@/features/checkout/service'
import type { PaymentAttemptStatus } from '@/features/checkout/types'
import type { OrderStatus, StoreChain } from '@/types/store'

export type E2EUser = {
  id: string
  email: string
  role: 'customer' | 'admin'
  passwordSalt: string
  passwordHash: string
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
  sessions: Map<string, E2ESession>
  attempts: Map<string, E2EAttempt>
  orders: Map<string, E2EOrder>
}

const ADMIN_USER: E2EUser = {
  id: 'admin',
  email: 'admin@mori.tw',
  role: 'admin',
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
    sessions: new Map(),
    attempts: new Map(),
    orders: new Map([[SEED_ORDER.orderNumber, structuredClone(SEED_ORDER)]]),
  }
}

export function getE2EStore() {
  fixtureGlobal.__moriE2EStore ??= createE2EStore()
  return fixtureGlobal.__moriE2EStore
}
