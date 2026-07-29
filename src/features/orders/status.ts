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

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending_payment: '待付款',
  paid: '已付款',
  preparing: '備貨中',
  shipped: '已出貨',
  collected: '已完成',
  cancelled: '已取消',
}

export const orderJourneySteps = ['訂單成立', '付款完成', '備貨中', '已出貨', '已完成'] as const

const activeSteps: Record<Exclude<OrderStatus, 'cancelled'>, number> = {
  pending_payment: 0,
  paid: 1,
  preparing: 2,
  shipped: 3,
  collected: 4,
}

export function getOrderJourney(status: OrderStatus, createdAt: string) {
  if (status === 'cancelled') {
    return { label: orderStatusLabels[status], activeStep: -1, estimatedArrival: '訂單已取消' }
  }
  if (status === 'collected') {
    return { label: orderStatusLabels[status], activeStep: activeSteps[status], estimatedArrival: '已完成取貨' }
  }

  const estimated = new Date(createdAt)
  estimated.setUTCDate(estimated.getUTCDate() + (status === 'shipped' ? 2 : 4))
  const estimatedArrival = new Intl.DateTimeFormat('zh-TW', {
    month: 'long', day: 'numeric', timeZone: 'Asia/Taipei',
  }).format(estimated).replace('月', ' 月 ').replace('日', ' 日')

  return {
    label: orderStatusLabels[status],
    activeStep: activeSteps[status],
    estimatedArrival: `${estimatedArrival}前送達門市`,
  }
}
