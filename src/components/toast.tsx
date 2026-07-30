'use client'

import { useEffect, useRef, useState } from 'react'

type ToastDetail = { message: string; ok: boolean }

const TOAST_EVENT = 'mori:toast'

// Fire a floating toast from anywhere in the client tree. Rendered by the
// <Toaster /> mounted in the admin layout, so it never shifts page layout.
export function showToast(message: string, ok = true) {
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, ok } }))
}

// Reports a useActionState result as a toast whenever a new state (with a
// message) arrives, instead of rendering layout-shifting inline text.
export function useActionToast(state: { ok: boolean; message?: string | null }) {
  const previous = useRef(state)
  useEffect(() => {
    if (state === previous.current) return
    previous.current = state
    if (state.message) showToast(state.message, state.ok)
  }, [state])
}

export function Toaster() {
  const [toast, setToast] = useState<(ToastDetail & { key: number }) | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<ToastDetail>).detail
      if (!detail?.message) return
      setToast({ ...detail, key: Date.now() })
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setToast(null), 3200)
    }
    window.addEventListener(TOAST_EVENT, onToast)
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast)
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  if (!toast) return null
  return (
    <div aria-live="polite" className="app-toast" data-ok={toast.ok} key={toast.key} role="status">
      <span aria-hidden="true">{toast.ok ? '✓' : '⚠'}</span>
      <p>{toast.message}</p>
    </div>
  )
}
