'use client'

import { useEffect, useRef, useState } from 'react'

export function DesktopHeaderSearch() {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return

    function onKeydown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    function onPointerdown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('keydown', onKeydown)
    document.addEventListener('pointerdown', onPointerdown)
    return () => {
      document.removeEventListener('keydown', onKeydown)
      document.removeEventListener('pointerdown', onPointerdown)
    }
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className="desktop-search" ref={containerRef}>
      <button
        aria-controls="desktop-header-search-panel"
        aria-expanded={open}
        aria-label={open ? '收合商品搜尋' : '開啟商品搜尋'}
        className="desktop-search-trigger"
        onClick={() => (open ? close() : setOpen(true))}
        ref={triggerRef}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
      </button>
      {open ? (
        <form action="/products" className="header-search" id="desktop-header-search-panel" method="get" role="search">
          <label htmlFor="header-product-search">搜尋商品</label>
          <input id="header-product-search" name="q" placeholder="搜尋商品" ref={inputRef} type="search" />
          <button aria-label="開始搜尋" type="submit">⌕</button>
        </form>
      ) : null}
    </div>
  )
}
