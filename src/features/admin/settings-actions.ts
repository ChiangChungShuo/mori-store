import { z } from 'zod'
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

function productionActions() {
  return createAdminSettingsActions({
    repository: createSupabaseStoreSettingsRepository(),
    requireAdmin: async () => {
      const { requireAdmin } = await import('@/lib/auth/require-admin')
      return requireAdmin()
    },
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
  return productionActions().updateStoreSettings({
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
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { data, error } = await createAdminClient()
    .from('store_settings')
    .select('key, value')
    .in('key', ['shipping_fee', 'free_shipping_threshold', 'contact_email'])
  if (error) throw error

  const settings = new Map((data ?? []).map((setting) => [setting.key, settingObject(setting.value)]))
  const shippingFee = settings.get('shipping_fee')?.amount
  const threshold = settings.get('free_shipping_threshold')?.amount
  const contactEmail = settings.get('contact_email')?.email

  return {
    shippingFee: typeof shippingFee === 'number' ? shippingFee : 60,
    freeShippingThreshold: threshold === null
      ? null
      : typeof threshold === 'number' ? threshold : 1500,
    contactEmail: typeof contactEmail === 'string' ? contactEmail : '',
  }
}
