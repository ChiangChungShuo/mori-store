import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isE2EMode } from '@/testing/e2e-mode'
import type { E2EOrder } from '@/testing/e2e-store'

export type MemberTier = 'seed' | 'forest' | 'canopy'

export const memberTierLabels: Record<MemberTier, string> = {
  seed: '種子會員',
  forest: '森林會員',
  canopy: '樹冠 VIP',
}

export type MemberRecord = {
  id: string
  email: string
  phone: string | null
  termsAcceptedAt: string | null
  name: string
  accountType: '會員' | '訪客'
  tier: MemberTier
  points: number
  discountPercent: number
  orderCount: number
  totalSpent: number
  orders: Array<Pick<E2EOrder, 'orderNumber' | 'createdAt' | 'status' | 'total'>>
}

function validOrders(orders: E2EOrder[]) {
  return orders.filter((order) => !['pending_payment', 'cancelled'].includes(order.status))
}

function suggestedTier(totalSpent: number, orderCount: number): MemberTier {
  if (totalSpent >= 10000 || orderCount >= 10) return 'canopy'
  if (totalSpent >= 3000 || orderCount >= 3) return 'forest'
  return 'seed'
}

export async function listMembers(): Promise<MemberRecord[]> {
  await requireAdmin()

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const store = getE2EStore()
    const emails = new Set([
      ...[...store.users.values()].filter((user) => user.role === 'customer').map((user) => user.email),
      ...[...store.orders.values()].map((order) => order.email),
    ])

    return [...emails].map((email) => {
      const user = [...store.users.values()].find((candidate) => candidate.email === email)
      const orders = [...store.orders.values()].filter((order) => order.email === email)
      const completedOrders = validOrders(orders)
      const totalSpent = completedOrders.reduce((total, order) => total + order.total, 0)
      const profile = store.memberProfiles.get(email)
      return {
        id: user?.id ?? `guest:${email}`,
        email,
        phone: user?.phone ?? null,
        termsAcceptedAt: user?.termsAcceptedAt ?? null,
        name: user?.displayName?.trim() || orders.at(0)?.recipientName || '尚未留下姓名',
        accountType: user ? '會員' as const : '訪客' as const,
        tier: profile?.tier ?? suggestedTier(totalSpent, completedOrders.length),
        points: profile?.points ?? Math.floor(totalSpent / 10),
        discountPercent: profile?.discountPercent ?? 0,
        orderCount: orders.length,
        totalSpent,
        orders: orders.map(({ orderNumber, createdAt, status, total }) => ({ orderNumber, createdAt, status, total })),
      }
    }).sort((a, b) => b.totalSpent - a.totalSpent)
  }

  const [{ createClient }, { createAdminClient }] = await Promise.all([
    import('@/lib/supabase/server'),
    import('@/lib/supabase/admin'),
  ])
  const supabase = await createClient()
  const [ordersResult, profilesResult, usersResult, memberProfilesResult] = await Promise.all([
    supabase.from('orders')
      .select('email, recipient_name, order_number, created_at, status, total')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, phone, terms_accepted_at'),
    createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 }),
    createAdminClient().from('member_profiles').select('email, tier, points, discount_percent'),
  ])
  if (ordersResult.error) throw ordersResult.error
  if (profilesResult.error) throw profilesResult.error
  if (usersResult.error) throw usersResult.error
  if (memberProfilesResult.error) throw memberProfilesResult.error

  const orders = ordersResult.data ?? []
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]))
  const memberOverrides = new Map((memberProfilesResult.data ?? []).map((row) => [row.email, row]))
  const users = new Map(usersResult.data.users
    .filter((user) => user.email)
    .map((user) => [user.email!.toLowerCase(), user]))
  const grouped = new Map<string, typeof orders>()
  for (const order of orders) grouped.set(order.email, [...(grouped.get(order.email) ?? []), order])
  const emails = new Set([...users.keys(), ...grouped.keys()])

  return [...emails].map((email) => {
    const memberOrders = grouped.get(email) ?? []
    const user = users.get(email)
    const profile = user ? profiles.get(user.id) : undefined
    const completedOrders = memberOrders.filter((order) => !['pending_payment', 'cancelled'].includes(order.status))
    const totalSpent = completedOrders.reduce((total, order) => total + order.total, 0)
    const override = memberOverrides.get(email)
    return {
      id: user?.id ?? `guest:${email}`,
      email,
      phone: profile?.phone ?? null,
      termsAcceptedAt: profile?.terms_accepted_at ?? null,
      name: ((user?.user_metadata as { display_name?: string } | undefined)?.display_name?.trim())
        || memberOrders[0]?.recipient_name
        || '尚未留下姓名',
      accountType: user ? '會員' as const : '訪客' as const,
      tier: (override?.tier as MemberTier | undefined) ?? suggestedTier(totalSpent, completedOrders.length),
      points: override?.points ?? Math.floor(totalSpent / 10),
      discountPercent: override?.discount_percent ?? 0,
      orderCount: memberOrders.length,
      totalSpent,
      orders: memberOrders.map((order) => ({
        orderNumber: order.order_number,
        createdAt: order.created_at,
        status: order.status,
        total: order.total,
      })),
    }
  }).sort((a, b) => b.totalSpent - a.totalSpent)
}

export async function getMemberDetail(email: string): Promise<MemberRecord | null> {
  const normalized = email.trim().toLowerCase()
  const members = await listMembers()
  return members.find((member) => member.email === normalized) ?? null
}

const memberUpdateSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  tier: z.enum(['seed', 'forest', 'canopy']),
  points: z.coerce.number().int().nonnegative(),
  discountPercent: z.coerce.number().int().min(0).max(100),
})

export type MemberUpdateState = { ok: boolean; message: string }

export async function updateMemberFromForm(
  _previousState: MemberUpdateState,
  formData: FormData,
): Promise<MemberUpdateState> {
  'use server'
  await requireAdmin()
  const parsed = memberUpdateSchema.safeParse({
    email: formData.get('email'),
    tier: formData.get('tier'),
    points: formData.get('points'),
    discountPercent: formData.get('discountPercent'),
  })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? '資料格式有誤' }
  const input = parsed.data

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    getE2EStore().memberProfiles.set(input.email, {
      tier: input.tier,
      points: input.points,
      discountPercent: input.discountPercent,
    })
    revalidatePath('/admin/members')
    return { ok: true, message: '會員資料已更新' }
  }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { error } = await createAdminClient().from('member_profiles').upsert({
    email: input.email,
    tier: input.tier,
    points: input.points,
    discount_percent: input.discountPercent,
  }, { onConflict: 'email' })
  if (error) return { ok: false, message: '目前無法更新，請稍後再試' }
  revalidatePath('/admin/members')
  return { ok: true, message: '會員資料已更新' }
}

export type Promotion = ReturnType<typeof promotionSchema.parse> & { id: string }

const promotionSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(['coupon', 'threshold_gift', 'quantity_discount']),
  code: z.string().trim().toUpperCase(),
  conditionValue: z.coerce.number().int().nonnegative(),
  rewardValue: z.coerce.number().int().nonnegative(),
  giftName: z.string().trim(),
  active: z.boolean(),
  startsAt: z.string().trim().optional().transform((value) => value ? new Date(value).toISOString() : null),
  endsAt: z.string().trim().optional().transform((value) => value ? new Date(value).toISOString() : null),
  usageLimit: z.enum(['unlimited', 'once_total', 'once_per_account']).default('unlimited'),
}).refine(
  (promotion) => !promotion.startsAt || !promotion.endsAt || promotion.endsAt > promotion.startsAt,
  { message: '結束時間必須晚於開始時間', path: ['endsAt'] },
)

function mapPromotionRow(row: {
  id: string
  name: string
  type: string
  code: string | null
  condition_value: number
  reward_value: number
  gift_name: string
  active: boolean
  starts_at?: string | null
  ends_at?: string | null
  usage_limit?: string | null
}): Promotion {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Promotion['type'],
    code: row.code ?? '',
    conditionValue: row.condition_value,
    rewardValue: row.reward_value,
    giftName: row.gift_name ?? '',
    active: row.active,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    usageLimit: (row.usage_limit ?? 'unlimited') as Promotion['usageLimit'],
  }
}

export async function getMarketingDashboard() {
  await requireAdmin()
  if (!isE2EMode()) {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data, error } = await createAdminClient()
      .from('promotions')
      .select('id, name, type, code, condition_value, reward_value, gift_name, active, starts_at, ends_at, usage_limit')
      .order('created_at', { ascending: false })
    if (error) throw error
    return { promotions: (data ?? []).map(mapPromotionRow), reminder: null, abandonedCarts: 0 }
  }
  const { getE2EStore } = await import('@/testing/e2e-store')
  const store = getE2EStore()
  const cartSessions = new Set(store.events.filter((event) => event.type === 'add_to_cart').map((event) => event.sessionId))
  const buyerSessions = new Set(store.events.filter((event) => event.type === 'purchase').map((event) => event.sessionId))
  return {
    promotions: store.promotions,
    reminder: store.abandonedCartReminder,
    abandonedCarts: [...cartSessions].filter((session) => !buyerSessions.has(session)).length,
  }
}

export async function createPromotionFromForm(formData: FormData) {
  'use server'
  await requireAdmin()
  const promotion = promotionSchema.parse({
    name: formData.get('name'),
    type: formData.get('type'),
    code: formData.get('code') ?? '',
    conditionValue: formData.get('conditionValue'),
    rewardValue: formData.get('rewardValue'),
    giftName: formData.get('giftName') ?? '',
    active: formData.get('active') === 'on',
    startsAt: formData.get('startsAt')?.toString() ?? '',
    endsAt: formData.get('endsAt')?.toString() ?? '',
    usageLimit: formData.get('usageLimit')?.toString() || 'unlimited',
  })
  if (!isE2EMode()) {
    if (promotion.type === 'coupon' && !promotion.code) {
      throw new Error('折扣碼類型請填寫折扣碼')
    }
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { error } = await createAdminClient().from('promotions').insert({
      name: promotion.name,
      type: promotion.type,
      code: promotion.code || null,
      condition_value: promotion.conditionValue,
      reward_value: promotion.rewardValue,
      gift_name: promotion.giftName,
      active: promotion.active,
      starts_at: promotion.startsAt,
      ends_at: promotion.endsAt,
      usage_limit: promotion.usageLimit,
    })
    if (error) {
      if (error.code === '23505') throw new Error('這個折扣碼已經存在，請換一組')
      throw error
    }
    revalidatePath('/admin/marketing')
    return
  }
  const { getE2EStore } = await import('@/testing/e2e-store')
  getE2EStore().promotions.unshift({ id: crypto.randomUUID(), ...promotion })
  revalidatePath('/admin/marketing')
}

export async function togglePromotionFromForm(formData: FormData) {
  'use server'
  await requireAdmin()
  if (!isE2EMode()) {
    const id = formData.get('id')?.toString()
    if (!id) return
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    const { data, error } = await admin.from('promotions').select('active').eq('id', id).maybeSingle()
    if (error || !data) return
    await admin.from('promotions').update({ active: !data.active }).eq('id', id)
    revalidatePath('/admin/marketing')
    return
  }
  const { getE2EStore } = await import('@/testing/e2e-store')
  const promotion = getE2EStore().promotions.find((candidate) => candidate.id === formData.get('id'))
  if (promotion) promotion.active = !promotion.active
  revalidatePath('/admin/marketing')
}

export async function deletePromotionFromForm(formData: FormData) {
  'use server'
  await requireAdmin()
  const id = formData.get('id')?.toString()
  if (!id) return
  if (!isE2EMode()) {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { error } = await createAdminClient().from('promotions').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/admin/marketing')
    return
  }
  const { getE2EStore } = await import('@/testing/e2e-store')
  const store = getE2EStore()
  store.promotions = store.promotions.filter((candidate) => candidate.id !== id)
  revalidatePath('/admin/marketing')
}

export async function updateReminderFromForm(formData: FormData) {
  'use server'
  await requireAdmin()
  const reminder = z.object({
    enabled: z.boolean(),
    delayHours: z.coerce.number().int().min(1).max(168),
    subject: z.string().trim().min(1),
  }).parse({
    enabled: formData.get('enabled') === 'on',
    delayHours: formData.get('delayHours'),
    subject: formData.get('subject'),
  })
  if (!isE2EMode()) throw new Error('正式提醒信需先串接郵件服務')
  const { getE2EStore } = await import('@/testing/e2e-store')
  getE2EStore().abandonedCartReminder = reminder
  revalidatePath('/admin/marketing')
}

type ReportOrder = Pick<E2EOrder, 'status' | 'total' | 'createdAt' | 'items'>

export function calculateSalesReport(orders: ReportOrder[], period: 'day' | 'month') {
  const paidOrders = orders.filter((order) => !['pending_payment', 'cancelled'].includes(order.status))
  const groups = new Map<string, { revenue: number; orders: number }>()
  const products = new Map<string, { quantity: number; revenue: number }>()

  for (const order of paidOrders) {
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit',
      ...(period === 'day' ? { day: '2-digit' } : {}),
    }).format(new Date(order.createdAt))
    const current = groups.get(date) ?? { revenue: 0, orders: 0 }
    groups.set(date, { revenue: current.revenue + order.total, orders: current.orders + 1 })
    for (const item of order.items) {
      const product = products.get(item.productName) ?? { quantity: 0, revenue: 0 }
      products.set(item.productName, {
        quantity: product.quantity + item.quantity,
        revenue: product.revenue + item.unitPrice * item.quantity,
      })
    }
  }

  return {
    periods: [...groups].map(([label, value]) => ({
      label,
      ...value,
      averageOrderValue: value.orders ? Math.round(value.revenue / value.orders) : 0,
    })).sort((a, b) => b.label.localeCompare(a.label)),
    products: [...products].map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.quantity - a.quantity),
    revenue: paidOrders.reduce((total, order) => total + order.total, 0),
    orderCount: paidOrders.length,
  }
}

export async function getSalesReport(period: 'day' | 'month') {
  await requireAdmin()
  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    return calculateSalesReport([...getE2EStore().orders.values()], period)
  }
  const { createClient } = await import('@/lib/supabase/server')
  const { data, error } = await (await createClient())
    .from('orders')
    .select('status, total, created_at, order_items(product_name, quantity, unit_price)')
  if (error) throw error
  return calculateSalesReport((data ?? []).map((order) => ({
    status: order.status,
    total: order.total,
    createdAt: order.created_at,
    items: order.order_items.map((item) => ({
      id: '', variantId: '', sku: '', color: '', size: '',
      productName: item.product_name, quantity: item.quantity, unitPrice: item.unit_price,
    })),
  })), period)
}
