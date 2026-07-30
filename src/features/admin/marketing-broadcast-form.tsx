'use client'

import { useActionState, useRef, useState } from 'react'
import { ConfirmModal } from '@/components/confirm-modal'
import type { BroadcastState } from '@/features/admin/marketing-broadcast'

export function MarketingBroadcastForm({
  subscriberCount,
  action,
}: {
  subscriberCount: number
  action: (state: BroadcastState, formData: FormData) => Promise<BroadcastState>
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: '' })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function requestSend() {
    const form = formRef.current
    if (!form) return
    if (!form.checkValidity()) { form.reportValidity(); return }
    setConfirmOpen(true)
  }

  return (
    <section className="admin-panel">
      <header><div><p className="eyebrow">broadcast</p><h2>群發新品／優惠公告</h2></div><strong>{subscriberCount} 位訂閱會員</strong></header>
      <form ref={formRef} action={formAction} data-no-confirm className="admin-stack-form">
        <label>主旨<input maxLength={120} name="subject" placeholder="例：本週新品上架・限時優惠" required /></label>
        <label>內容<textarea maxLength={4000} name="body" placeholder="輸入公告內容，換行會自動分段。" required rows={7} /></label>
        <button type="button" className="button" disabled={pending || subscriberCount === 0} onClick={requestSend}>
          {pending ? '寄送中…' : subscriberCount === 0 ? '目前沒有訂閱會員' : `寄送給 ${subscriberCount} 位訂閱會員`}
        </button>
        {state.message ? <p aria-live="polite" data-success={state.ok} className="admin-banner-status">{state.message}</p> : null}
        <p className="admin-field-hint">只會寄給註冊時勾選「接收新品優惠消息」的會員；寄件人為 noreply@moribebe.com。</p>
      </form>
      <ConfirmModal
        open={confirmOpen}
        title={`確定要寄給 ${subscriberCount} 位訂閱會員嗎？`}
        message="信件寄出後無法收回，請確認主旨與內容無誤。"
        confirmLabel="確定寄送"
        pending={pending}
        onConfirm={() => { setConfirmOpen(false); formRef.current?.requestSubmit() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  )
}
