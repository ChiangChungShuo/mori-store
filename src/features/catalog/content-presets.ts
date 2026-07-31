import { isE2EMode } from '@/testing/e2e-mode'
import { contentPresetDefaults, type ContentPresetKind } from '@/features/catalog/content-preset-defaults'

export type { ContentPresetKind }

type PresetState = { ok: boolean; message: string }

function parseKind(value: FormDataEntryValue | null): ContentPresetKind | null {
  return value === 'material' || value === 'care' || value === 'size' || value === 'series'
    ? value
    : null
}

export async function listContentPresets(kind: ContentPresetKind): Promise<string[]> {
  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    return [...getE2EStore().contentPresets[kind]]
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return [...contentPresetDefaults[kind]]
  }
  const { createClient } = await import('@/lib/supabase/server')
  const { data, error } = await (await createClient())
    .from('content_presets')
    .select('value')
    .eq('kind', kind)
    .order('position')
    .order('created_at')
  if (error) throw error
  const values = (data ?? []).map((row) => row.value)
  return values.length ? values : [...contentPresetDefaults[kind]]
}

const revalidatePaths = ['/admin/categories', '/admin/products/new']

/**
 * Adds a preset without the form plumbing, for callers that create the value as
 * a side effect (e.g. creating a series remembers its name as a chip).
 * Silent about duplicates — the point is that the chip exists afterwards.
 */
export async function rememberContentPreset(kind: ContentPresetKind, valueInput: string) {
  const value = valueInput.trim()
  if (!value || value.length > 200) return

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const list = getE2EStore().contentPresets[kind]
    if (!list.includes(value)) list.push(value)
    return
  }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data } = await admin.from('content_presets').select('position').eq('kind', kind)
    .order('position', { ascending: false }).limit(1)
  await admin.from('content_presets').insert({
    kind,
    value,
    position: (data?.[0]?.position ?? -1) + 1,
  })
}

export async function createContentPresetFromForm(
  _previousState: PresetState,
  formData: FormData,
): Promise<PresetState> {
  'use server'
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()
  const kind = parseKind(formData.get('kind'))
  const value = String(formData.get('value') ?? '').trim()
  if (!kind) return { ok: false, message: '類型無效' }
  if (!value) return { ok: false, message: '請輸入內容' }
  if (value.length > 200) return { ok: false, message: '內容請控制在 200 字以內' }

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const list = getE2EStore().contentPresets[kind]
    if (!list.includes(value)) list.push(value)
  } else {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    const { data } = await admin.from('content_presets').select('position').eq('kind', kind)
      .order('position', { ascending: false }).limit(1)
    const position = (data?.[0]?.position ?? -1) + 1
    const { error } = await admin.from('content_presets').insert({ kind, value, position })
    if (error) {
      if (error.code === '23505') return { ok: false, message: '這個項目已存在' }
      return { ok: false, message: '目前無法新增，請稍後再試' }
    }
  }
  const { revalidatePath } = await import('next/cache')
  for (const path of revalidatePaths) revalidatePath(path)
  return { ok: true, message: `已新增「${value}」` }
}

export async function deleteContentPresetFromForm(
  _previousState: PresetState,
  formData: FormData,
): Promise<PresetState> {
  'use server'
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()
  const kind = parseKind(formData.get('kind'))
  const value = String(formData.get('value') ?? '').trim()
  if (!kind || !value) return { ok: false, message: '請選擇要刪除的項目' }

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const presets = getE2EStore().contentPresets
    presets[kind] = presets[kind].filter((item) => item !== value)
  } else {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { error } = await createAdminClient().from('content_presets').delete().eq('kind', kind).eq('value', value)
    if (error) return { ok: false, message: '目前無法刪除，請稍後再試' }
  }
  const { revalidatePath } = await import('next/cache')
  for (const path of revalidatePaths) revalidatePath(path)
  return { ok: true, message: `已刪除「${value}」` }
}
