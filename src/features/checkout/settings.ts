import type { Json } from '@/types/database'
import { isE2EMode } from '@/testing/e2e-mode'

export type StorefrontSettings = {
  shippingFee: number
  freeShippingThreshold: number | null
}

type StoreSettingRow = {
  key: string
  value: Json
}

function settingAmount(value: Json | undefined) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return undefined
  return value.amount
}

export function parseStorefrontSettings(rows: StoreSettingRow[]): StorefrontSettings {
  const settings = new Map(rows.map((row) => [row.key, row.value]))
  const shippingFee = settingAmount(settings.get('shipping_fee'))
  const freeShippingThreshold = settingAmount(settings.get('free_shipping_threshold'))
  const validShippingFee = typeof shippingFee === 'number'
    && Number.isInteger(shippingFee)
    && shippingFee >= 0
  const validThreshold = freeShippingThreshold === null
    || (typeof freeShippingThreshold === 'number'
      && Number.isInteger(freeShippingThreshold)
      && freeShippingThreshold >= 0)

  if (!validShippingFee || !validThreshold) {
    throw new Error('商店運費設定無效')
  }
  return { shippingFee, freeShippingThreshold }
}

export async function getStorefrontSettings() {
  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const { shippingFee, freeShippingThreshold } = getE2EStore().settings
    return { shippingFee, freeShippingThreshold }
  }
  const { createClient } = await import('@/lib/supabase/server')
  const { data, error } = await (await createClient())
    .from('store_settings')
    .select('key, value')
    .in('key', ['shipping_fee', 'free_shipping_threshold'])
  if (error) throw error
  return parseStorefrontSettings(data ?? [])
}
