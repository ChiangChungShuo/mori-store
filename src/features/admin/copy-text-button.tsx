'use client'

import { useEffect, useRef, useState } from 'react'

// Shipping is handled by hand (7-11 賣貨便), so the owner retypes the same
// recipient block for every order. This copies the whole block in one tap.
export function CopyTextButton({ label, text, copiedLabel = '已複製' }: {
  label: string
  text: string
  copiedLabel?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Insecure origins and older browsers have no clipboard API.
      const field = document.createElement('textarea')
      field.value = text
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
    timer.current = window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button className="admin-inline-action" data-copied={copied} onClick={copy} type="button">
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
      {copied ? copiedLabel : label}
    </button>
  )
}
