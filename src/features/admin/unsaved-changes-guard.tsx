'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ConfirmModal } from '@/components/confirm-modal'

/**
 * Warns before leaving a form with unsaved edits.
 *
 * `beforeunload` covers reloads and closing the tab, but App Router link clicks
 * never reach it, so internal links are intercepted in the capture phase and
 * replayed through the router once the owner confirms.
 */
export function UnsavedChangesGuard({ dirty, message }: { dirty: boolean; message?: string }) {
  const router = useRouter()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  // `dirty` only flips once per save cycle, so re-registering on it is cheap.
  useEffect(() => {
    if (!dirty) return
    function warnOnUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      // Browsers show their own wording; the returnValue is only the opt-in.
      event.returnValue = ''
    }

    function interceptLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = (event.target as Element | null)?.closest?.('a[href]')
      if (!(link instanceof HTMLAnchorElement)) return
      if (link.target === '_blank' || link.hasAttribute('download')) return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      event.preventDefault()
      event.stopPropagation()
      setPendingHref(`${url.pathname}${url.search}${url.hash}`)
    }

    window.addEventListener('beforeunload', warnOnUnload)
    document.addEventListener('click', interceptLink, true)
    return () => {
      window.removeEventListener('beforeunload', warnOnUnload)
      document.removeEventListener('click', interceptLink, true)
    }
  }, [dirty])

  return (
    <ConfirmModal
      cancelLabel="留在這頁"
      confirmLabel="離開不儲存"
      message={message ?? '這個頁面有尚未儲存的修改，離開後就會消失。'}
      onCancel={() => setPendingHref(null)}
      onConfirm={() => {
        const href = pendingHref
        setPendingHref(null)
        if (href) router.push(href)
      }}
      open={Boolean(pendingHref)}
      title="要放棄未儲存的修改嗎？"
      tone="danger"
    />
  )
}
