'use client'

import { useEffect, useRef, useState } from 'react'

export function MobileHeaderSearch() {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Tapping anywhere outside dismisses the panel — on a phone, hunting for the
  // × is the only way out otherwise.
  useEffect(() => {
    if (!open) return
    function closeFromOutside(event: PointerEvent) {
      const target = event.target as Node | null
      if (!target) return
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', closeFromOutside)
    return () => document.removeEventListener('pointerdown', closeFromOutside)
  }, [open])

  useEffect(() => {
    function closeFromEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !open) return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('keydown', closeFromEscape)
    return () => document.removeEventListener('keydown', closeFromEscape)
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return <>
    <button
      aria-controls="mobile-header-search-panel"
      aria-expanded={open}
      aria-label={open ? '收合商品搜尋' : '開啟商品搜尋'}
      className="mobile-header-icon-button mobile-search-trigger"
      onClick={() => open ? close() : setOpen(true)}
      ref={triggerRef}
      type="button"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
    </button>
    {open ? <div className="mobile-header-search-panel" id="mobile-header-search-panel" ref={panelRef}>
      <form action="/products" method="get" role="search">
        <label htmlFor="mobile-header-product-search">搜尋商品</label>
        <div className="mobile-header-search-field">
          <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
            <circle cx="6.8" cy="6.8" r="5.2" stroke="currentColor" strokeWidth="1.6" />
            <path d="m10.8 10.8 3.7 3.7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
          </svg>
          <input id="mobile-header-product-search" name="q" placeholder="搜尋商品名稱" ref={inputRef} type="search" />
          <button aria-label="關閉商品搜尋" className="mobile-header-search-close" onClick={close} type="button">
            <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 14 14" width="14">
              <path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
            </svg>
          </button>
        </div>
        <button className="mobile-header-search-submit" type="submit">搜尋</button>
      </form>
    </div> : null}
  </>
}
