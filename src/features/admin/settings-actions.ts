import { z } from 'zod'
import { parseStorefrontSettings } from '@/features/checkout/settings'
import type { Json } from '@/types/database'

const nonNegativeInteger = z.union([
  z.number(),
  z.string().trim().regex(/^\d+$/).transform(Number),
]).pipe(z.number().int().nonnegative())

export const settingsSchema = z.object({
  shippingFee: nonNegativeInteger,
  freeShippingThreshold: z.preprocess(
    (value) => value === '' ? null : value,
    nonNegativeInteger.nullable(),
  ),
  contactEmail: z.string().trim().toLowerCase().email(),
})

export type StoreSettings = z.output<typeof settingsSchema>

export interface StoreSettingsRepository {
  updateSettings(settings: StoreSettings): Promise<void>
}

type AdminSettingsDependencies = {
  repository: StoreSettingsRepository
  requireAdmin: () => Promise<unknown>
  onChanged?: () => void | Promise<void>
}

export function createAdminSettingsActions(dependencies: AdminSettingsDependencies) {
  return {
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
    async updateSettings(settings) {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { error } = await supabase.rpc('admin_update_store_settings', {
        p_shipping_fee: settings.shippingFee,
        p_free_shipping_threshold: settings.freeShippingThreshold,
        p_contact_email: settings.contactEmail,
      })
      if (error) throw error
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

export async function updateStoreSettings(input: unknown) {
  'use server'
  return productionActions().updateStoreSettings(input)
}

export async function updateStoreSettingsFromForm(formData: FormData) {
  'use server'
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()
  return productionActions(async () => undefined).updateStoreSettings({
    shippingFee: formData.get('shippingFee'),
    freeShippingThreshold: formData.get('freeShippingThreshold'),
    contactEmail: formData.get('contactEmail'),
  })
}

function settingObject(value: Json | undefined) {
  return value && !Array.isArray(value) && typeof value === 'object' ? value : null
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()
  const { createClient } = await import('@/lib/supabase/server')
  const { data, error } = await (await createClient())
    .from('store_settings')
    .select('key, value')
    .in('key', ['shipping_fee', 'free_shipping_threshold', 'contact_email'])
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
  }
}
