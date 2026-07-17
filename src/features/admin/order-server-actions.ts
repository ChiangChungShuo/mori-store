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
