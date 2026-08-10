'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { showToast } from '@/components/toast'

/**
 * Copies a product and opens the copy's editor straight away — the admin is
 * always going to change something (colour, name, prices), so landing on the
 * list again would only cost another click.
 */
export function DuplicateProductButton({ duplicate, productName }: {
  duplicate: () => Promise<{ ok: boolean; message?: string; productId?: string }>
  productName: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      className="admin-inline-action"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await duplicate()
        showToast(result.message ?? (result.ok ? '已複製商品' : '複製失敗'), result.ok)
        if (result.ok && result.productId) router.push(`/admin/products/${result.productId}/edit`)
      })}
      title={`以「${productName}」為範本建立新商品`}
      type="button"
    >
      {pending ? '複製中…' : '複製商品'}
    </button>
  )
}
