import { isE2EMode } from '@/testing/e2e-mode'
import type { Json } from '@/types/database'

export type ProductDraftSummary = { id: string; label: string; updatedAt: string }
export type SaveDraftState = { ok: boolean; id?: string; message: string }

// Keys stored alongside the product fields inside the draft JSON.
export const DRAFT_IMAGES_KEY = '__draftImages'
export const DRAFT_IMAGE_ALT_KEY = '__draftImageAlt'

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

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

// Uploads a draft image and returns a URL the browser can load later. In
// fixture mode files become data URLs; live files land in the product-images
// bucket under drafts/ so they survive page reloads.
async function storeDraftImage(file: File): Promise<string | null> {
  if (!IMAGE_EXTENSIONS[file.type] || file.size === 0 || file.size > 5 * 1024 * 1024) return null
  if (isE2EMode()) {
    const bytes = Buffer.from(await file.arrayBuffer()).toString('base64')
    return `data:${file.type};base64,${bytes}`
  }
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const path = `drafts/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[file.type]}`
  const { error } = await admin.storage.from('product-images').upload(path, file, { contentType: file.type })
  if (error) return null
  return admin.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

function storagePathFromUrl(url: string): string | null {
  const marker = '/product-images/'
  const index = url.indexOf(marker)
  return index === -1 ? null : url.slice(index + marker.length)
}

async function removeDraftImages(data: unknown) {
  if (isE2EMode()) return
  const urls = (data as Record<string, unknown> | null)?.[DRAFT_IMAGES_KEY]
  if (!Array.isArray(urls)) return
  const paths = urls.filter((url): url is string => typeof url === 'string')
    .map(storagePathFromUrl)
    .filter((path): path is string => Boolean(path?.startsWith('drafts/')))
  if (!paths.length) return
  const { createAdminClient } = await import('@/lib/supabase/admin')
  await createAdminClient().storage.from('product-images').remove(paths).then(() => undefined, () => undefined)
}

export async function saveProductDraft(draftId: string | null, payload: FormData): Promise<SaveDraftState> {
  'use server'
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()

  let product: Record<string, unknown>
  try {
    product = JSON.parse(String(payload.get('product') ?? '{}')) as Record<string, unknown>
  } catch {
    return { ok: false, message: '草稿資料格式有誤' }
  }

  // Images kept from a previous draft save, plus any newly selected files.
  let keptImages: string[] = []
  try {
    const parsed = JSON.parse(String(payload.get('existingImages') ?? '[]')) as unknown
    if (Array.isArray(parsed)) keptImages = parsed.filter((url): url is string => typeof url === 'string').slice(0, 8)
  } catch { /* ignore */ }

  const uploaded: string[] = []
  for (const entry of payload.getAll('file')) {
    if (entry instanceof File && entry.size > 0) {
      const url = await storeDraftImage(entry)
      if (url) uploaded.push(url)
    }
  }

  const draftData = {
    ...product,
    [DRAFT_IMAGES_KEY]: [...keptImages, ...uploaded],
    [DRAFT_IMAGE_ALT_KEY]: String(payload.get('alt') ?? ''),
  }
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
  const imageCount = keptImages.length + uploaded.length
  return {
    ok: true,
    id: draftId ?? undefined,
    message: imageCount > 0 ? `草稿已儲存，含 ${imageCount} 張圖片（尚未上架）` : '草稿已儲存（尚未上架）',
  }
}

// Removes a draft and any images it stored. Used by the drafts list and after
// a draft is turned into a real product.
export async function discardProductDraft(id: string): Promise<void> {
  'use server'
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()
  if (!id) return

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const store = getE2EStore()
    store.productDrafts = store.productDrafts.filter((draft) => draft.id !== id)
  } else {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    const { data } = await admin.from('product_drafts').select('data').eq('id', id).maybeSingle()
    if (data) await removeDraftImages(data.data)
    await admin.from('product_drafts').delete().eq('id', id)
  }
  const { revalidatePath } = await import('next/cache')
  revalidatePath('/admin/products')
}

export async function deleteProductDraftFromForm(formData: FormData): Promise<void> {
  'use server'
  const id = formData.get('id')?.toString()
  if (!id) return
  await discardProductDraft(id)
}
