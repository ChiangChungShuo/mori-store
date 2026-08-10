'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmModal } from '@/components/confirm-modal'
import { showToast } from '@/components/toast'

/**
 * Copies a product and opens the copy's editor straight away — the admin is
 * always going to change something (colour, name, prices), so landing on the
 * list again would only cost another click. Confirmed first, because a stray
 * click would otherwise leave a stray draft behind.
 */
export function DuplicateProductButton({ duplicate, productName }: {
  duplicate: () => Promise<{ ok: boolean; message?: string; productId?: string }>
  productName: string
}) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <>
      <button
        className="admin-inline-action"
        disabled={pending}
        onClick={() => setAsking(true)}
        title={`以「${productName}」為範本建立新商品`}
        type="button"
      >
        {pending ? '複製中…' : '複製商品'}
      </button>
      <ConfirmModal
        cancelLabel="取消"
        confirmLabel="建立複本"
        message={`會以「${productName}」的內容、規格與圖片建立一個新的草稿商品，不會影響原本的商品，也不會直接上架。`}
        onCancel={() => setAsking(false)}
        onConfirm={() => startTransition(async () => {
          const result = await duplicate()
          setAsking(false)
          showToast(result.message ?? (result.ok ? '已複製商品' : '複製失敗'), result.ok)
          if (result.ok && result.productId) router.push(`/admin/products/${result.productId}/edit`)
        })}
        open={asking}
        pending={pending}
        title="複製這個商品？"
      />
    </>
  )
}
