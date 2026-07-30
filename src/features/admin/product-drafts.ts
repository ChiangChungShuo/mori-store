import { isE2EMode } from '@/testing/e2e-mode'
import type { Json } from '@/types/database'

export type ProductDraftSummary = { id: string; label: string; updatedAt: string }
export type SaveDraftState = { ok: boolean; id?: string; message: string }

function deriveLabel(data: unknown): string {
  const name = (data as { name?: unknown })?.name
  const trimmed = typeof name === 'string' ? name.trim() : ''
  return (trimmed || '未命名草稿').slice(0, 60)
}

export async function listProductDrafts(): Promise<ProductDraftSummary[]> {
  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    return [...getE2EStore().productDrafts]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((draft) => ({ id: draft.id, label: draft.label, updatedAt: draft.updatedAt }))
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return []
  const { createClient } = await import('@/lib/supabase/server')
  const { data, error } = await (await createClient())
    .from('product_drafts')
    .select('id, label, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({ id: row.id, label: row.label, updatedAt: row.updated_at }))
}

export async function getProductDraft(id: string): Promise<unknown | null> {
  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    return getE2EStore().productDrafts.find((draft) => draft.id === id)?.data ?? null
  }
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { data, error } = await createAdminClient().from('product_drafts').select('data').eq('id', id).maybeSingle()
  if (error) throw error
  return data?.data ?? null
}

export async function saveProductDraft(draftId: string | null, draftData: unknown): Promise<SaveDraftState> {
  'use server'
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()
  const label = deriveLabel(draftData)

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const drafts = getE2EStore().productDrafts
    const now = new Date().toISOString()
    const existing = draftId ? drafts.find((draft) => draft.id === draftId) : null
    if (existing) {
      existing.data = draftData
      existing.label = label
      existing.updatedAt = now
    } else {
      const id = draftId ?? crypto.randomUUID()
      drafts.push({ id, label, data: draftData, updatedAt: now })
      draftId = id
    }
  } else {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    if (draftId) {
      const { error } = await admin.from('product_drafts').update({ label, data: draftData as Json }).eq('id', draftId)
      if (error) return { ok: false, message: '無法儲存草稿，請稍後再試' }
    } else {
      const { data, error } = await admin.from('product_drafts').insert({ label, data: draftData as Json }).select('id').single()
      if (error) return { ok: false, message: '無法儲存草稿，請稍後再試' }
      draftId = data.id
    }
  }
  const { revalidatePath } = await import('next/cache')
  revalidatePath('/admin/products')
  return { ok: true, id: draftId ?? undefined, message: '草稿已儲存（尚未上架）' }
}

export async function deleteProductDraftFromForm(formData: FormData): Promise<void> {
  'use server'
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()
  const id = formData.get('id')?.toString()
  if (!id) return

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const store = getE2EStore()
    store.productDrafts = store.productDrafts.filter((draft) => draft.id !== id)
  } else {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    await createAdminClient().from('product_drafts').delete().eq('id', id)
  }
  const { revalidatePath } = await import('next/cache')
  revalidatePath('/admin/products')
}
