'use client'

import { useActionState, useState } from 'react'
import { useActionToast } from '@/components/toast'

type ReplyState = { ok: boolean; message: string }

export function OrderReplyForm({
  initialReply,
  reply,
}: {
  initialReply: string
  reply: (state: ReplyState, formData: FormData) => Promise<ReplyState>
}) {
  const [state, formAction, pending] = useActionState(reply, { ok: false, message: '' })
  const [value, setValue] = useState(initialReply)
  useActionToast(state)

  // Clear the input the moment a reply is saved, so the box is ready for the
  // next note. Uses React's render-time "adjust state on change" pattern
  // (tracking the last-seen action state) rather than an effect.
  const [seenState, setSeenState] = useState(state)
  if (state !== seenState) {
    setSeenState(state)
    if (state.ok) setValue('')
  }

  return (
    <form action={formAction} className="admin-order-reply-form">
      <label htmlFor="merchant-reply">回覆客戶</label>
      <textarea
        id="merchant-reply"
        maxLength={1000}
        name="reply"
        onChange={(event) => setValue(event.target.value)}
        placeholder="例如：尺寸已確認，會依訂單內容為您出貨。"
        required
        rows={5}
        value={value}
      />
      <div>
        <small>回覆會顯示在會員訂單與訪客訂單查詢結果。</small>
        <button className="button" disabled={pending} type="submit">{pending ? '儲存中…' : '儲存回覆'}</button>
      </div>
    </form>
  )
}
