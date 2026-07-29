'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// A native <details> dropdown that also closes when you click outside it or press Escape.
export function AutoCloseDetails({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    function onPointerDown(event: PointerEvent) {
      if (element!.open && !element!.contains(event.target as Node)) element!.open = false
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && element!.open) element!.open = false
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return <details className={className} ref={ref}>{children}</details>
}
