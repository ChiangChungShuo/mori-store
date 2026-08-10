'use server'

import { isE2EMode } from '@/testing/e2e-mode'

/**
 * The 註冊禮 shown to visitors before they sign up and to members afterwards.
 *
 * It is a coupon, not a stored-value wallet: the shop has no balance ledger, so
 * the gift is spent in one go on a single order. The code itself lives in
 * 促銷活動 (with 每個帳號限用一次); this setting is only what the storefront says
 * about it.
 */
export type WelcomeGift = {
  enabled: boolean
  code: string
  amount: number
  minimumSpend: number
}

const SETTINGS_KEY = 'welcome_gift'

function parseWelcomeGift(value: unknown): WelcomeGift | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, unknown>
  const code = typeof source.code === 'string' ? source.code.trim().toUpperCase() : ''
  const amount = Number(source.amount)
  if (!code || !Number.isFinite(amount) || amount <= 0) return null
  return {
    enabled: source.enabled === true,
    code,
    amount: Math.round(amount),
    minimumSpend: Number.isFinite(Number(source.minimumSpend)) ? Math.max(0, Math.round(Number(source.minimumSpend))) : 0,
  }
}

/** Returns the gift only when it is switched on, so callers can render blindly. */
export async function getActiveWelcomeGift(): Promise<WelcomeGift | null> {
  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const gift = parseWelcomeGift(getE2EStore().welcomeGift)
    return gift?.enabled ? gift : null
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  const { createClient } = await import('@/lib/supabase/server')
  const { data } = await (await createClient())
    .from('store_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()
  const gift = parseWelcomeGift(data?.value)
  return gift?.enabled ? gift : null
}

/** Admin view: the saved settings whether or not the gift is switched on. */
export async function getWelcomeGiftSettings(): Promise<WelcomeGift> {
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()
  const fallback: WelcomeGift = { enabled: false, code: '', amount: 50, minimumSpend: 0 }

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    return parseWelcomeGift(getE2EStore().welcomeGift) ?? fallback
  }
  const { createClient } = await import('@/lib/supabase/server')
  const { data } = await (await createClient())
    .from('store_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()
  return parseWelcomeGift(data?.value) ?? fallback
}

export async function saveWelcomeGiftFromForm(formData: FormData) {
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()

  const next: WelcomeGift = {
    enabled: formData.get('enabled') === 'on',
    code: String(formData.get('code') ?? '').trim().toUpperCase().slice(0, 32),
    amount: Math.max(0, Math.round(Number(formData.get('amount') ?? 0))),
    minimumSpend: Math.max(0, Math.round(Number(formData.get('minimumSpend') ?? 0))),
  }

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    getE2EStore().welcomeGift = next
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    await (await createClient()).from('store_settings').upsert({ key: SETTINGS_KEY, value: next }, { onConflict: 'key' })
  }

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/admin/marketing')
  revalidatePath('/signup')
  revalidatePath('/account')
}
