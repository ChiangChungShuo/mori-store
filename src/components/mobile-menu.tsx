'use client'

import { useRef, useState, type MouseEvent, type ReactNode } from 'react'

export function MobileMenu({ ariaLabel, children, heading, id }: {
  ariaLabel: string
  children: ReactNode
  heading: string
  id: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  function openMenu() {
    dialogRef.current?.showModal()
    setOpen(true)
  }

  function closeMenu() {
    dialogRef.current?.close()
  }

  function handleDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeMenu()
  }

  return (
    <div className="mobile-menu">
      <button
        aria-controls={id}
        aria-expanded={open}
        aria-label={open ? '關閉選單' : '開啟選單'}
        className="mobile-menu-trigger"
        onClick={openMenu}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true"><i /><i /><i /></span>
      </button>
      <dialog
        aria-label={ariaLabel}
        className="mobile-menu-dialog"
        id={id}
        onCancel={(event) => { event.preventDefault(); closeMenu() }}
        onClick={handleDialogClick}
        onClose={() => { setOpen(false); triggerRef.current?.focus() }}
        ref={dialogRef}
      >
        <div className="mobile-menu-panel">
          <header>
            <strong>{heading}</strong>
            <button aria-label="關閉選單" onClick={closeMenu} type="button">×</button>
          </header>
          <div className="mobile-menu-content" onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) closeMenu()
          }}>{children}</div>
        </div>
      </dialog>
    </div>
  )
}
