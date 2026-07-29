'use server'

import { revalidatePath } from 'next/cache'
import { bankTransferLastFiveSchema } from '@/lib/validation/checkout'
import { requireUser } from '@/lib/auth/require-user'
import { isE2EMode } from '@/testing/e2e-mode'

export type BankTransferState = {
  status: 'idle' | 'error' | 'success'
  message?: string
}

export async function submitBankTransferLastFive(
  orderNumber: string,
  _previousState: BankTransferState,
  formData: FormData,
): Promise<BankTransferState> {
  const user = await requireUser()
  const parsed = bankTransferLastFiveSchema.safeParse(formData.get('lastFive'))
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message }

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const order = getE2EStore().orders.get(orderNumber)
    if (!order || order.userId !== user.id || order.paymentMethod !== 'bank_transfer') {
      return { status: 'error', message: '找不到可填寫匯款資料的訂單' }
    }
    order.bankTransferLastFive = parsed.data
    order.bankTransferSubmittedAt = new Date().toISOString()
  } else {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data, error } = await createAdminClient()
      .from('orders')
      .update({
        bank_transfer_last_five: parsed.data,
        bank_transfer_submitted_at: new Date().toISOString(),
      })
      .eq('order_number', orderNumber)
      .eq('user_id', user.id)
      .eq('payment_method', 'bank_transfer')
      .in('status', ['pending_payment', 'paid'])
      .select('id')
      .maybeSingle()
    if (error || !data) return { status: 'error', message: '目前無法儲存，請稍後再試' }
  }

  revalidatePath(`/account/orders/${orderNumber}`)
  revalidatePath(`/admin/orders/${orderNumber}`)
  return { status: 'success', message: '末 5 碼已送出，店家核對後會更新付款狀態。' }
}

export async function submitGuestBankTransferLastFive(
  orderNumber: string,
  email: string,
  _previousState: BankTransferState,
  formData: FormData,
): Promise<BankTransferState> {
  const parsed = bankTransferLastFiveSchema.safeParse(formData.get('lastFive'))
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message }
  const normalizedEmail = email.trim().toLowerCase()

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const order = getE2EStore().orders.get(orderNumber)
    if (!order || order.email !== normalizedEmail || order.paymentMethod !== 'bank_transfer') {
      return { status: 'error', message: '找不到可填寫匯款資料的訂單' }
    }
    order.bankTransferLastFive = parsed.data
    order.bankTransferSubmittedAt = new Date().toISOString()
  } else {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data, error } = await createAdminClient()
      .from('orders')
      .update({ bank_transfer_last_five: parsed.data, bank_transfer_submitted_at: new Date().toISOString() })
      .eq('order_number', orderNumber)
      .eq('email', normalizedEmail)
      .eq('payment_method', 'bank_transfer')
      .eq('status', 'pending_payment')
      .select('id')
      .maybeSingle()
    if (error || !data) return { status: 'error', message: '目前無法儲存，請稍後再試' }
  }

  revalidatePath('/order-lookup')
  revalidatePath(`/admin/orders/${orderNumber}`)
  return { status: 'success', message: '末 5 碼已送出，店家核對後會更新付款狀態。' }
}
