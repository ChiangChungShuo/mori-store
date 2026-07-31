import { z } from 'zod'
import { parseStorefrontSettings } from '@/features/checkout/settings'
import type { Json } from '@/types/database'

const nonNegativeInteger = z.union([
  z.number(),
  z.string().trim().regex(/^\d+$/).transform(Number),
]).pipe(z.number().int().nonnegative())

export const defaultSitePresentation = {
  siteTitle: 'mori 童裝商城｜0–12 歲孩子的日常選衣',
  siteDescription: '為 0–12 歲孩子挑選親膚、耐穿、自在活動的日常服，支援 7-ELEVEN 取貨。',
  siteKeywords: ['童裝', '兒童服飾', '親膚童裝', '0–12 歲穿搭', '超商取貨'],
  googleAnalyticsId: null as string | null,
}

const siteTitleSchema = z.string().trim().min(1, '網站主標題為必填').max(70, '網站主標題最多 70 個字')
const siteDescriptionSchema = z.string().trim().min(20, 'Description 至少 20 個字').max(160, 'Description 最多 160 個字')
const siteKeywordsSchema = z.array(z.string().trim().min(1).max(40)).max(5, '最多設定 5 組關鍵字')
const googleAnalyticsIdSchema = z.preprocess(
  (value) => value === '' ? null : value,
  z.string().trim().toUpperCase().regex(/^G-[A-Z0-9]+$/, '請輸入 G- 開頭的 GA4 Measurement ID').nullable(),
)

export const settingsSchema = z.object({
  shippingFee: nonNegativeInteger,
  freeShippingThreshold: z.preprocess(
    (value) => value === '' ? null : value,
    nonNegativeInteger.nullable(),
  ),
  contactEmail: z.string().trim().toLowerCase().email(),
  siteTitle: siteTitleSchema.optional(),
  siteDescription: siteDescriptionSchema.optional(),
  siteKeywords: siteKeywordsSchema.optional(),
  googleAnalyticsId: googleAnalyticsIdSchema.optional(),
})

export type StoreSettings = z.output<typeof settingsSchema>

export interface StoreSettingsRepository {
  getSettings(): Promise<StoreSettings>
  updateSettings(settings: StoreSettings): Promise<void>
}

type AdminSettingsDependencies = {
  repository: StoreSettingsRepository
  requireAdmin: () => Promise<unknown>
  onChanged?: () => void | Promise<void>
}

export function createAdminSettingsActions(dependencies: AdminSettingsDependencies) {
  return {
    async getStoreSettings() {
      await dependencies.requireAdmin()
      return dependencies.repository.getSettings()
    },
    async updateStoreSettings(input: unknown) {
      await dependencies.requireAdmin()
      const parsed = settingsSchema.safeParse(input)
      if (!parsed.success) throw new Error('請檢查商店設定')
      await dependencies.repository.updateSettings(parsed.data)
      await dependencies.onChanged?.()
    },
  }
}

function createSupabaseStoreSettingsRepository(): StoreSettingsRepository {
  return {
    async getSettings() {
      const { createClient } = await import('@/lib/supabase/server')
      const { data, error } = await (await createClient())
        .from('store_settings')
        .select('key, value')
        .in('key', ['shipping_fee', 'free_shipping_threshold', 'contact_email', 'site_title', 'site_description', 'site_keywords', 'google_analytics_id'])
      if (error) throw error

      const settings = new Map((data ?? []).map((setting) => [setting.key, settingObject(setting.value)]))
      const storefrontSettings = parseStorefrontSettings(data ?? [])
      const contactEmail = settings.get('contact_email')?.email
      if (contactEmail !== undefined && typeof contactEmail !== 'string') {
        throw new Error('商店聯絡信箱設定無效')
      }

      return {
        ...storefrontSettings,
        contactEmail: contactEmail ?? '',
        siteTitle: settingText(settings.get('site_title'), 'text') ?? defaultSitePresentation.siteTitle,
        siteDescription: settingText(settings.get('site_description'), 'text') ?? defaultSitePresentation.siteDescription,
        siteKeywords: settingStrings(settings.get('site_keywords'), 'items') ?? defaultSitePresentation.siteKeywords,
        googleAnalyticsId: settingText(settings.get('google_analytics_id'), 'id') ?? null,
      }
    },
    async updateSettings(settings) {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { error } = await supabase.rpc('admin_update_store_settings', {
        p_shipping_fee: settings.shippingFee,
        p_free_shipping_threshold: settings.freeShippingThreshold,
        p_contact_email: settings.contactEmail,
      })
      if (error) throw error
      const siteRows: Array<{ key: string; value: Json }> = []
      if (settings.siteTitle !== undefined) siteRows.push({ key: 'site_title', value: { text: settings.siteTitle } })
      if (settings.siteDescription !== undefined) siteRows.push({ key: 'site_description', value: { text: settings.siteDescription } })
      if (settings.siteKeywords !== undefined) siteRows.push({ key: 'site_keywords', value: { items: settings.siteKeywords } })
      if (settings.googleAnalyticsId !== undefined) siteRows.push({ key: 'google_analytics_id', value: { id: settings.googleAnalyticsId } })
      if (siteRows.length) {
        const { error: siteError } = await supabase.from('store_settings').upsert(siteRows, { onConflict: 'key' })
        if (siteError) throw siteError
      }
    },
  }
}

function createFixtureStoreSettingsRepository(): StoreSettingsRepository {
  return {
    async getSettings() {
      const { getE2EStore } = await import('@/testing/e2e-store')
      return { ...getE2EStore().settings }
    },
    async updateSettings(settings) {
      const { getE2EStore } = await import('@/testing/e2e-store')
      getE2EStore().settings = { ...settings }
    },
  }
}

function productionActions(requireAdminOverride?: () => Promise<unknown>) {
  return createAdminSettingsActions({
    repository: createSupabaseStoreSettingsRepository(),
    requireAdmin: requireAdminOverride ?? (async () => {
      const { requireAdmin } = await import('@/lib/auth/require-admin')
      return requireAdmin()
    }),
    onChanged: async () => {
      const { revalidatePath } = await import('next/cache')
      revalidatePath('/admin/settings')
    },
  })
}

async function resolvedActions(requireAdminOverride?: () => Promise<unknown>) {
  const { isE2EMode } = await import('@/testing/e2e-mode')
  if (!isE2EMode()) return productionActions(requireAdminOverride)
  return createAdminSettingsActions({
    repository: createFixtureStoreSettingsRepository(),
    requireAdmin: requireAdminOverride ?? (async () => {
      const { requireAdmin } = await import('@/lib/auth/require-admin')
      return requireAdmin()
    }),
    onChanged: async () => {
      const { revalidatePath } = await import('next/cache')
      revalidatePath('/admin/settings')
      revalidatePath('/cart')
      revalidatePath('/checkout')
    },
  })
}

export async function updateStoreSettings(input: unknown) {
  'use server'
  return (await resolvedActions()).updateStoreSettings(input)
}

export async function updateStoreSettingsFromForm(formData: FormData) {
  'use server'
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()
  return (await resolvedActions(async () => undefined)).updateStoreSettings({
    shippingFee: formData.get('shippingFee'),
    freeShippingThreshold: formData.get('freeShippingThreshold'),
    contactEmail: formData.get('contactEmail'),
    siteTitle: formData.get('siteTitle'),
    siteDescription: formData.get('siteDescription'),
    siteKeywords: Array.from({ length: 5 }, (_, index) => String(formData.get(`siteKeyword-${index}`) ?? '').trim()).filter(Boolean),
    googleAnalyticsId: formData.get('googleAnalyticsId'),
  })
}

function settingObject(value: Json | undefined) {
  return value && !Array.isArray(value) && typeof value === 'object' ? value : null
}

function settingText(value: Record<string, Json | undefined> | null | undefined, key: string) {
  const candidate = value?.[key]
  return typeof candidate === 'string' ? candidate : undefined
}

function settingStrings(value: Record<string, Json | undefined> | null | undefined, key: string) {
  const candidate = value?.[key]
  return Array.isArray(candidate) && candidate.every((item) => typeof item === 'string') ? candidate : undefined
}

export type SitePresentationSettings = typeof defaultSitePresentation

export async function getPublicSiteSettings(): Promise<SitePresentationSettings> {
  const { isE2EMode } = await import('@/testing/e2e-mode')
  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const settings = getE2EStore().settings
    return {
      siteTitle: settings.siteTitle ?? defaultSitePresentation.siteTitle,
      siteDescription: settings.siteDescription ?? defaultSitePresentation.siteDescription,
      siteKeywords: settings.siteKeywords ?? defaultSitePresentation.siteKeywords,
      googleAnalyticsId: settings.googleAnalyticsId ?? null,
    }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const { data, error } = await (await createClient())
    .from('store_settings')
    .select('key, value')
    .in('key', ['site_title', 'site_description', 'site_keywords', 'google_analytics_id'])
  if (error) throw error
  const values = new Map((data ?? []).map((row) => [row.key, settingObject(row.value)]))
  return {
    siteTitle: settingText(values.get('site_title') ?? null, 'text') ?? defaultSitePresentation.siteTitle,
    siteDescription: settingText(values.get('site_description') ?? null, 'text') ?? defaultSitePresentation.siteDescription,
    siteKeywords: settingStrings(values.get('site_keywords') ?? null, 'items') ?? defaultSitePresentation.siteKeywords,
    googleAnalyticsId: settingText(values.get('google_analytics_id') ?? null, 'id') ?? null,
  }
}

export async function getStoreSettings(): Promise<StoreSettings> {
  return (await resolvedActions()).getStoreSettings()
}
