'use client'

import { useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { showToast } from '@/components/toast'

type ReorderResult = { ok: boolean; message?: string }

/**
 * Drag-to-reorder for the product gallery.
 *
 * The list items stay server-rendered (each carries its own colour and delete
 * forms); this wrapper only moves the DOM nodes while dragging and saves the
 * resulting order. HTML5 drag-and-drop does not fire on touch screens, so the
 * per-image ← → buttons stay as the accessible and mobile path.
 */
export function ImageOrderDragArea({ children, reorder }: {
  children: ReactNode
  reorder: (imageIds: string[]) => Promise<ReorderResult>
}) {
  const router = useRouter()
  const listRef = useRef<HTMLUListElement>(null)
  const draggingId = useRef<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [dragging, setDragging] = useState(false)

  function itemFrom(target: EventTarget | null) {
    return (target as Element | null)?.closest?.('[data-image-id]') as HTMLElement | null
  }

  function currentOrder() {
    const list = listRef.current
    if (!list) return []
    return [...list.querySelectorAll<HTMLElement>('[data-image-id]')]
      .map((item) => item.dataset.imageId!)
      .filter(Boolean)
  }

  return (
    <ul
      aria-label="商品圖片，可拖曳調整順序"
      className="admin-product-image-grid"
      data-dragging={dragging}
      onDragEnd={() => {
        draggingId.current = null
        setDragging(false)
      }}
      onDragOver={(event) => {
        if (!draggingId.current) return
        event.preventDefault()
        const over = itemFrom(event.target)
        const list = listRef.current
        if (!over || !list) return
        const dragged = list.querySelector<HTMLElement>(`[data-image-id="${draggingId.current}"]`)
        if (!dragged || dragged === over) return
        // Insert before or after depending on which half the pointer is over,
        // so the preview matches where the image will land.
        const box = over.getBoundingClientRect()
        const after = event.clientX > box.left + box.width / 2
        over.parentElement?.insertBefore(dragged, after ? over.nextSibling : over)
      }}
      onDragStart={(event) => {
        const item = itemFrom(event.target)
        if (!item?.dataset.imageId) return
        draggingId.current = item.dataset.imageId
        setDragging(true)
        event.dataTransfer.effectAllowed = 'move'
        // Firefox refuses to start a drag without payload.
        event.dataTransfer.setData('text/plain', item.dataset.imageId)
      }}
      onDrop={(event) => {
        event.preventDefault()
        draggingId.current = null
        setDragging(false)
        const order = currentOrder()
        if (order.length === 0) return
        startTransition(async () => {
          const result = await reorder(order)
          showToast(result.message ?? (result.ok ? '商品圖片順序已更新' : '排序失敗'), result.ok)
          // Re-render from the server so the saved order is the one on screen.
          router.refresh()
        })
      }}
      ref={listRef}
      data-saving={pending}
    >
      {children}
    </ul>
  )
}
