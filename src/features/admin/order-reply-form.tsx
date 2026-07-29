'use client'

import { useActionState } from 'react'

type ReplyState = { ok: boolean; message: string }

export function OrderReplyForm({
  initialReply,
  reply,
}: {
  initialReply: string
  reply: (state: ReplyState, formData: FormData) => Promise<ReplyState>
}) {
  const [state, formAction, pending] = useActionState(reply, { ok: false, message: '' })

  return (
    <form action={formAction} className="admin-order-reply-form">
      <label htmlFor="merchant-reply">回覆客戶</label>
      <textarea
        defaultValue={initialReply}
        id="merchant-reply"
        maxLength={1000}
        name="reply"
        placeholder="例如：尺寸已確認，會依訂單內容為您出貨。"
        required
        rows={5}
      />
      <div>
        <small>回覆會顯示在會員訂單與訪客訂單查詢結果。</small>
        <button className="button" disabled={pending} type="submit">{pending ? '儲存中…' : '儲存回覆'}</button>
      </div>
      {state.message ? <p aria-live="polite" data-success={state.ok}>{state.message}</p> : null}
    </form>
  )
}
