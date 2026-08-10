import { isE2EMode } from '@/testing/e2e-mode'

export type MemberCreditEntry = {
  amount: number
  reason: 'signup_gift' | 'order' | 'manual'
  createdAt: string
}

export type MemberCredit = {
  balance: number
  entries: MemberCreditEntry[]
}

/**
 * The signed-in member's 購物金, claiming the 新會員禮 on the way if this account
 * has not had it yet. Claiming is idempotent in the database (one gift row per
 * account), so calling this from any page the member lands on is safe.
 */
export async function getMemberCredit(): Promise<MemberCredit> {
  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const { getCurrentUser } = await import('@/lib/auth/require-user')
    const user = await getCurrentUser()
    if (!user) return { balance: 0, entries: [] }
    const store = getE2EStore()
    const gift = store.welcomeGift
    const alreadyGranted = store.memberCredits.some((entry) => (
      entry.userId === user.id && entry.reason === 'signup_gift'
    ))
    if (gift?.enabled && gift.amount > 0 && !alreadyGranted) {
      store.memberCredits.push({
        userId: user.id,
        amount: gift.amount,
        reason: 'signup_gift',
        orderId: null,
        createdAt: new Date().toISOString(),
      })
    }
    const mine = store.memberCredits.filter((entry) => entry.userId === user.id)
    return {
      balance: mine.reduce((total, entry) => total + entry.amount, 0),
      entries: mine.map(({ amount, reason, createdAt }) => ({ amount, reason, createdAt })),
    }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { balance: 0, entries: [] }

  // Grants the gift when due and returns the resulting balance; the row-level
  // read below is what the page actually renders.
  await supabase.rpc('claim_signup_credit')

  const { data, error } = await supabase
    .from('member_credits')
    .select('amount, reason, created_at')
    .order('created_at', { ascending: false })
  if (error) return { balance: 0, entries: [] }

  const entries = (data ?? []).map((entry) => ({
    amount: entry.amount,
    reason: entry.reason as MemberCreditEntry['reason'],
    createdAt: entry.created_at,
  }))
  return { balance: entries.reduce((total, entry) => total + entry.amount, 0), entries }
}

/**
 * Balance for a specific member, used by checkout to work out how much credit
 * this order can spend. Reads with the service role because the checkout runs
 * before the shopper's own session is necessarily available in that path.
 */
export async function getMemberCreditBalance(userId: string): Promise<number> {
  if (!userId) return 0

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    return getE2EStore().memberCredits
      .filter((entry) => entry.userId === userId)
      .reduce((total, entry) => total + entry.amount, 0)
  }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { data, error } = await createAdminClient()
    .from('member_credits')
    .select('amount')
    .eq('user_id', userId)
  if (error) return 0
  return (data ?? []).reduce((total, entry) => total + entry.amount, 0)
}
