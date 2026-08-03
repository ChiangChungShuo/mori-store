'use client'

import { useEffect, useRef, useState } from 'react'

// Members quote their order number when messaging us, so make it one tap to copy.
export function CopyOrderNumber({ orderNumber }: { orderNumber: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(orderNumber)
    } catch {
      // Older browsers and insecure origins have no clipboard API.
      const field = document.createElement('textarea')
      field.value = orderNumber
      field.setAttribute('readonly', '')
      field.style.position = 'fixed'
      field.style.opacity = '0'
      document.body.append(field)
      field.select()
      document.execCommand('copy')
      field.remove()
    }
    setCopied(true)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      aria-label={`複製訂單編號 ${orderNumber}`}
      className="copy-order-number"
      data-copied={copied}
      onClick={copy}
      type="button"
    >
      {copied ? (
        <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 14 14" width="13">
          <path d="m2.5 7.4 3 3 6-6.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        </svg>
      ) : (
        <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 14 14" width="13">
          <rect height="8.5" rx="1.6" stroke="currentColor" strokeWidth="1.4" width="7.5" x="5" y="4.5" />
          <path d="M9.4 2.2H3.1c-.6 0-1.1.5-1.1 1.1v6.3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
        </svg>
      )}
      <span>{copied ? '已複製' : '複製'}</span>
    </button>
  )
}
