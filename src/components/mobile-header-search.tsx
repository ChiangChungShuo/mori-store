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
        <input id="mobile-header-product-search" name="q" placeholder="搜尋商品" ref={inputRef} type="search" />
        <button aria-label="開始搜尋" type="submit">搜尋</button>
        <button aria-label="關閉商品搜尋" onClick={close} type="button">×</button>
      </form>
    </div> : null}
  </>
}
