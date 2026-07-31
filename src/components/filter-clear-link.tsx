'use client'

import Link from 'next/link'

/**
 * 清除條件 link for filter forms.
 *
 * Navigating to the bare URL only resets filters that were applied; text typed
 * into uncontrolled inputs without pressing 套用 survives navigation, which
 * makes the clear look broken. Resetting the enclosing form on click covers
 * that case, and the form's filter-derived key covers the applied one.
 */
export function FilterClearLink({ href, className }: { href: string; className?: string }) {
  return (
    <Link
      className={className ?? 'filter-clear-button'}
      href={href}
      onClick={(event) => event.currentTarget.closest('form')?.reset()}
    >
      <span aria-hidden="true">↺</span> 清除條件
    </Link>
  )
}
