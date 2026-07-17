import type { OrderStatus } from '@/types/store'

const next: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['collected'],
  collected: [],
  cancelled: [],
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus) {
  return next[from].includes(to)
}
