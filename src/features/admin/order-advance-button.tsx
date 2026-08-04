'use client'

import { useTransition } from 'react'
import { showToast } from '@/components/toast'
import { advanceOrderStatus } from '@/features/admin/order-server-actions'
import type { OrderStatus } from '@/types/store'

// The next fulfilment step for each status, so the list can move an order along
// without opening it. 已付款 also offers a direct jump to 已出貨 for the common
// case where packing and shipping happen in one go.
const nextSteps: Partial<Record<OrderStatus, Array<{ target: OrderStatus; label: string; done: string }>>> = {
  pending_payment: [{ target: 'paid', label: '標記已付款', done: '已標記為已付款' }],
  paid: [
    { target: 'preparing', label: '開始備貨', done: '已改為備貨中' },
    { target: 'shipped', label: '標記已出貨', done: '已標記為已出貨' },
  ],
  preparing: [{ target: 'shipped', label: '標記已出貨', done: '已標記為已出貨' }],
  shipped: [{ target: 'collected', label: '標記已完成', done: '已標記為已完成' }],
}

export function OrderAdvanceButtons({ orderId, status, onDone }: {
  orderId: string
  status: OrderStatus
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  const steps = nextSteps[status] ?? []
  if (steps.length === 0) return null

  function advance(target: OrderStatus, done: string) {
    startTransition(async () => {
      const payload = new FormData()
      payload.set('orderId', orderId)
      payload.set('from', status)
      payload.set('target', target)
      try {
        await advanceOrderStatus(payload)
        showToast(done, true)
        onDone()
      } catch (error) {
        showToast(error instanceof Error ? error.message : '狀態更新失敗', false)
      }
    })
  }

  return (
    <div className="admin-order-row-actions">
      {steps.map((step) => (
        <button
          className="admin-inline-action"
          disabled={pending}
          key={step.target}
          onClick={() => advance(step.target, step.done)}
          type="button"
        >
          {pending ? '處理中…' : step.label}
        </button>
      ))}
    </div>
  )
}
