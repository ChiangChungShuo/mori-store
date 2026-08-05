'use server'

import { z } from 'zod'
import { isE2EMode } from '@/testing/e2e-mode'
import type { RestockRequestState } from '@/features/catalog/restock-requests'

const requestSchema = z.object({
  productId: z.string().uuid('商品資訊有誤，請重新整理頁面'),
  email: z.string().trim().toLowerCase().email('請輸入正確的 Email'),
})

export async function registerRestockRequest(
  _previousState: RestockRequestState,
  formData: FormData,
): Promise<RestockRequestState> {
  const parsed = requestSchema.safeParse({
    productId: formData.get('productId'),
    email: formData.get('email'),
  })
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? '請確認填寫內容' }
  }

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const store = getE2EStore()
    const existing = store.restockRequests.find((request) => (
      request.productId === parsed.data.productId
      && request.email === parsed.data.email
      && request.notifiedAt === null
    ))
    if (!existing) {
      store.restockRequests.push({
        id: crypto.randomUUID(),
        productId: parsed.data.productId,
        email: parsed.data.email,
        notifiedAt: null,
        createdAt: new Date().toISOString(),
      })
    }
    return { status: 'ok', message: '登記完成，補貨後會寄信通知你' }
  }

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { error } = await supabase.rpc('request_restock_notice', {
      p_product_id: parsed.data.productId,
      p_email: parsed.data.email,
    })
    if (error) throw error
  } catch {
    return { status: 'error', message: '目前無法登記，請稍後再試' }
  }

  return { status: 'ok', message: '登記完成，補貨後會寄信通知你' }
}
