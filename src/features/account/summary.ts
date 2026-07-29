import type { User } from '@supabase/supabase-js'
import { listOrdersForUser, type OrderDetails } from '@/features/orders/queries'
import { isE2EMode } from '@/testing/e2e-mode'
import type { AuthenticatedUser } from '@/testing/e2e-auth-repository'

type AccountUser = User | AuthenticatedUser
type MemberTier = 'seed' | 'forest' | 'canopy'

const tierRules = {
  seed: { label: '種子會員', threshold: 3000, discount: 0 },
  forest: { label: '森林會員', threshold: 10000, discount: 3 },
  canopy: { label: '樹冠 VIP', threshold: 10000, discount: 5 },
} satisfies Record<MemberTier, { label: string; threshold: number; discount: number }>

function validOrders(orders: OrderDetails[]) {
  return orders.filter((order) => !['pending_payment', 'cancelled'].includes(order.status))
}

function tierFromSpend(totalSpent: number): MemberTier {
  if (totalSpent >= tierRules.forest.threshold) return 'canopy'
  if (totalSpent >= tierRules.seed.threshold) return 'forest'
  return 'seed'
}

export async function getAccountSummary(user: AccountUser) {
  const orders = await listOrdersForUser(user.id)
  const completedOrders = validOrders(orders)
  const totalSpent = completedOrders.reduce((total, order) => total + order.total, 0)
  const email = user.email ?? ''
  let tier = tierFromSpend(totalSpent)
  let points = Math.floor(totalSpent / 10)
  let discountPercent = tierRules[tier].discount
  let displayName = email.split('@')[0] || 'mori 會員'
  let phone: string | null = null

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const store = getE2EStore()
    const profile = store.memberProfiles.get(email.toLowerCase())
    const fixtureUser = store.users.get(user.id)
    phone = fixtureUser?.phone ?? null
    displayName = fixtureUser?.displayName?.trim() || displayName
    if (profile) {
      tier = profile.tier
      points = profile.points
      discountPercent = profile.discountPercent
    }
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const { data } = await (await createClient())
      .from('profiles')
      .select('display_name, phone')
      .eq('id', user.id)
      .maybeSingle()
    displayName = data?.display_name?.trim() || displayName
    phone = data?.phone ?? null
  }

  const nextThreshold = tier === 'seed' ? tierRules.seed.threshold : tierRules.forest.threshold
  const progress = tier === 'canopy' ? 100 : Math.min(100, Math.round(totalSpent / nextThreshold * 100))

  return {
    userId: user.id,
    email,
    phone,
    displayName,
    memberNumber: `MO-${user.id.replaceAll('-', '').slice(0, 10).toUpperCase()}`,
    tier,
    tierLabel: tierRules[tier].label,
    points,
    discountPercent,
    totalSpent,
    orderCount: orders.length,
    progress,
    nextTierLabel: tier === 'seed' ? tierRules.forest.label : tier === 'forest' ? tierRules.canopy.label : null,
    amountToNextTier: tier === 'canopy' ? 0 : Math.max(0, nextThreshold - totalSpent),
    orders,
  }
}
