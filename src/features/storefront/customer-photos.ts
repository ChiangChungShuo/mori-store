import { isE2EMode } from '@/testing/e2e-mode'

export type CustomerPhoto = {
  id: string
  productId: string | null
  imageUrl: string
  caption: string
}

export type CustomerPhotoState = { ok: boolean; message: string }

const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export async function listCustomerPhotos(productId?: string): Promise<CustomerPhoto[]> {
  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const photos = getE2EStore().customerPhotos
    return productId ? photos.filter((photo) => photo.productId === productId) : photos
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return []

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    let query = supabase
      .from('customer_photos')
      .select('id, product_id, image_url, caption')
      .order('position')
      .order('created_at', { ascending: false })
    if (productId) query = query.eq('product_id', productId)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: row.id,
      productId: row.product_id,
      imageUrl: row.image_url,
      caption: row.caption,
    }))
  } catch {
    // Social proof is an enhancement — never break the page for it.
    return []
  }
}

export async function addCustomerPhotoFromForm(
  _previousState: CustomerPhotoState,
  formData: FormData,
): Promise<CustomerPhotoState> {
  'use server'
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()

  const file = formData.get('file')
  const caption = String(formData.get('caption') ?? '').trim().slice(0, 120)
  const productId = String(formData.get('productId') ?? '').trim() || null
  if (!(file instanceof File) || !file.size) return { ok: false, message: '請選擇照片' }
  const extension = PHOTO_TYPES[file.type]
  if (!extension) return { ok: false, message: '照片只支援 JPEG、PNG 或 WebP' }
  if (file.size > 5 * 1024 * 1024) return { ok: false, message: '照片不可超過 5 MB' }

  let imageUrl: string
  if (isE2EMode()) {
    const bytes = Buffer.from(await file.arrayBuffer()).toString('base64')
    imageUrl = `data:${file.type};base64,${bytes}`
  } else {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    const path = `customer/${crypto.randomUUID()}.${extension}`
    const { error } = await admin.storage.from('product-images').upload(path, file, { contentType: file.type })
    if (error) return { ok: false, message: '照片上傳失敗，請稍後再試' }
    imageUrl = admin.storage.from('product-images').getPublicUrl(path).data.publicUrl
  }

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    getE2EStore().customerPhotos.unshift({ id: crypto.randomUUID(), productId, imageUrl, caption })
  } else {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { error } = await createAdminClient()
      .from('customer_photos')
      .insert({ product_id: productId, image_url: imageUrl, caption })
    if (error) return { ok: false, message: '目前無法新增照片，請稍後再試' }
  }

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/admin/marketing')
  return { ok: true, message: '已新增顧客照片' }
}

export async function deleteCustomerPhotoFromForm(
  _previousState: CustomerPhotoState,
  formData: FormData,
): Promise<CustomerPhotoState> {
  'use server'
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, message: '請選擇要刪除的照片' }

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const store = getE2EStore()
    store.customerPhotos = store.customerPhotos.filter((photo) => photo.id !== id)
  } else {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { error } = await createAdminClient().from('customer_photos').delete().eq('id', id)
    if (error) return { ok: false, message: '目前無法刪除，請稍後再試' }
  }

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/admin/marketing')
  return { ok: true, message: '已刪除顧客照片' }
}
