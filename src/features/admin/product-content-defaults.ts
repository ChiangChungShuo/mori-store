'use server'

import { isE2EMode } from '@/testing/e2e-mode'

/** The three descriptive fields that are the same on almost every product. */
export type ProductContentDefaults = {
  material: string
  careInstructions: string
  sizeGuide: string
}

export type ProductContentSources = {
  /** Saved deliberately by the shop owner in the product form. */
  defaults: ProductContentDefaults | null
  /** The most recently created product, for a one-click 沿用上一件. */
  previous: (ProductContentDefaults & { name: string }) | null
}

const SETTINGS_KEY = 'product_content_defaults'

function readField(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key]
  return typeof value === 'string' ? value.slice(0, 4000) : ''
}

function toDefaults(source: Record<string, unknown> | null | undefined): ProductContentDefaults | null {
  const defaults = {
    material: readField(source, 'material'),
    careInstructions: readField(source, 'careInstructions'),
    sizeGuide: readField(source, 'sizeGuide'),
  }
  return defaults.material || defaults.careInstructions || defaults.sizeGuide ? defaults : null
}

/**
 * Both ways of not retyping 材質／洗滌／平量: the store defaults the owner saved,
 * and whatever the last product used. Read together so the new-product page can
 * prefer the defaults and still offer the previous product as a second option.
 */
export async function getProductContentSources(): Promise<ProductContentSources> {
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const { getMutableE2EProducts } = await import('@/testing/e2e-storefront-fixtures')
    const latest = getMutableE2EProducts()[0]
    return {
      defaults: toDefaults(getE2EStore().productContentDefaults),
      previous: latest
        ? {
          name: latest.name,
          material: latest.material,
          careInstructions: latest.careInstructions,
          sizeGuide: latest.sizeGuide,
        }
        : null,
    }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const [settingRow, latestProduct] = await Promise.all([
    supabase.from('store_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle(),
    supabase.from('products')
      .select('name, material, care_instructions, size_guide')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const latest = latestProduct.data
  return {
    defaults: toDefaults(settingRow.data?.value as Record<string, unknown> | null),
    previous: latest
      ? {
        name: latest.name,
        material: latest.material ?? '',
        careInstructions: latest.care_instructions ?? '',
        sizeGuide: latest.size_guide ?? '',
      }
      : null,
  }
}

export async function saveProductContentDefaults(values: unknown): Promise<{ ok: boolean; message: string }> {
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()

  const source = (values ?? {}) as Record<string, unknown>
  const next: ProductContentDefaults = {
    material: readField(source, 'material').trim(),
    careInstructions: readField(source, 'careInstructions').trim(),
    sizeGuide: readField(source, 'sizeGuide').trim(),
  }
  if (!next.material && !next.careInstructions && !next.sizeGuide) {
    return { ok: false, message: '請先填寫材質、洗滌說明或平量資訊，再設為預設' }
  }

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    getE2EStore().productContentDefaults = next
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const { error } = await (await createClient())
      .from('store_settings')
      .upsert({ key: SETTINGS_KEY, value: next }, { onConflict: 'key' })
    if (error) return { ok: false, message: '目前無法儲存預設值，請稍後再試' }
  }

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/admin/products/new')
  return { ok: true, message: '已設為商店預設，下次新增商品會自動帶入' }
}
