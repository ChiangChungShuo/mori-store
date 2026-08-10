'use client'

import { useActionState, useState } from 'react'
import { useActionToast } from '@/components/toast'

type TrackingState = { ok: boolean; message: string }

/**
 * 物流追蹤碼. Pasted from 7-ELEVEN 賣貨便 when the parcel ships: it goes into the
 * 已出貨 email and onto the customer's own order page, which is the difference
 * between "已出貨" and an answer to 「到了沒」.
 */
export function OrderTrackingForm({
  initialCode,
  save,
}: {
  initialCode: string
  save: (state: TrackingState, formData: FormData) => Promise<TrackingState>
}) {
  const [state, formAction, pending] = useActionState(save, { ok: false, message: '' })
  const [value, setValue] = useState(initialCode)
  useActionToast(state)

  return (
    <form action={formAction} className="admin-tracking-form">
      <label>
        物流追蹤碼（選填）
        <input
          maxLength={60}
          name="trackingCode"
          onChange={(event) => setValue(event.target.value)}
          placeholder="例：7-ELEVEN 交貨便代碼 F123456789"
          value={value}
        />
      </label>
      <button className="button button-secondary" disabled={pending} type="submit">
        {pending ? '儲存中…' : '儲存追蹤碼'}
      </button>
      <small>填好之後，「標記已出貨」寄出的通知信與顧客的訂單頁都會顯示這組代碼；留空即清除。</small>
    </form>
  )
}
