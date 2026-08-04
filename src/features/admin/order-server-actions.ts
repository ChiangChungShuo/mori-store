'use server'

import {
  listAdminOrders,
  type AdminOrderListState,
} from '@/features/admin/order-actions'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { OrderStatus } from '@/types/store'

export async function filterAdminOrders(
  _previousState: AdminOrderListState,
  formData: FormData,
): Promise<AdminOrderListState> {
  await requireAdmin()
  const clear = formData.get('clear') === '1'
  const query = clear ? '' : String(formData.get('query') ?? '').trim()
  const requestedStatus = clear ? '' : String(formData.get('status') ?? '')
  const status: OrderStatus | '' = [
    'pending_payment',
    'paid',
    'preparing',
    'shipped',
    'collected',
    'cancelled',
  ].includes(requestedStatus) ? requestedStatus as OrderStatus : ''
  const orders = await listAdminOrders({ query, status })
  return { query, status, orders }
}

// Sequential fulfilment chain. The list buttons let the owner jump straight to
// a later step (e.g. 已付款 → 已出貨) by walking the legal transitions one by
// one, so the domain rules and the per-step timestamps still apply.
const fulfilmentChain: OrderStatus[] = ['pending_payment', 'paid', 'preparing', 'shipped', 'collected']

export async function advanceOrderStatus(formData: FormData) {
  await requireAdmin()
  const orderId = String(formData.get('orderId') ?? '')
  const from = String(formData.get('from') ?? '') as OrderStatus
  const target = String(formData.get('target') ?? '') as OrderStatus
  const fromIndex = fulfilmentChain.indexOf(from)
  const targetIndex = fulfilmentChain.indexOf(target)
  if (fromIndex < 0 || targetIndex <= fromIndex) throw new Error('無法變更為此狀態')

  const { updateOrderStatus } = await import('@/features/admin/order-actions')
  for (const step of fulfilmentChain.slice(fromIndex + 1, targetIndex + 1)) {
    await updateOrderStatus(orderId, step)
  }
}
