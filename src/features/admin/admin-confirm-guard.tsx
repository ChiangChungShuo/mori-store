'use client'

import { useEffect, useRef, useState } from 'react'
import { ConfirmModal } from '@/components/confirm-modal'

type Pending = { form: HTMLFormElement; submitter: HTMLElement | null; danger: boolean }

// Intercepts admin save/delete form submissions and asks for confirmation.
// It only guards mutating forms (POST server actions, or forms opting in via
// data-confirm). GET filter/search forms and forms with data-no-confirm are
// left alone.
export function AdminConfirmGuard() {
  const [pending, setPending] = useState<Pending | null>(null)
  const confirmed = useRef<WeakSet<HTMLFormElement>>(new WeakSet())

  useEffect(() => {
    function onSubmit(event: Event) {
      const form = event.target
      if (!(form instanceof HTMLFormElement)) return
      if (confirmed.current.has(form)) { confirmed.current.delete(form); return }
      if (form.dataset.noConfirm !== undefined) return
      const method = (form.getAttribute('method') || 'get').toLowerCase()
      const optIn = form.dataset.confirm !== undefined
      if (method !== 'post' && !optIn) return

      const submitter = (event as SubmitEvent).submitter as HTMLElement | null
      const label = (submitter?.getAttribute('aria-label') || submitter?.textContent || '').trim()
      const danger = form.dataset.confirm === 'danger' || /刪除|移除|清除|delete|remove/i.test(label)

      event.preventDefault()
      event.stopPropagation()
      setPending({ form, submitter, danger })
    }
    document.addEventListener('submit', onSubmit, true)
    return () => document.removeEventListener('submit', onSubmit, true)
  }, [])

  function handleConfirm() {
    if (!pending) return
    const { form, submitter } = pending
    confirmed.current.add(form)
    setPending(null)
    if (submitter && (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement)) {
      form.requestSubmit(submitter)
    } else {
      form.requestSubmit()
    }
  }

  return (
    <ConfirmModal
      open={Boolean(pending)}
      title={pending?.danger ? '確定要刪除嗎？' : '確定要儲存嗎？'}
      message={pending?.danger ? '此動作無法復原，請再次確認。' : '將儲存這項變更。'}
      confirmLabel={pending?.danger ? '確定刪除' : '確定儲存'}
      tone={pending?.danger ? 'danger' : 'default'}
      onConfirm={handleConfirm}
      onCancel={() => setPending(null)}
    />
  )
}
