'use client'

import { useState, useTransition } from 'react'

type UploadResult = { ok: boolean; message?: string }

export function ImageUploader({
  upload,
}: {
  upload: (formData: FormData) => Promise<UploadResult>
}) {
  const [result, setResult] = useState<UploadResult | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    startTransition(async () => {
      try {
        const nextResult = await upload(new FormData(form))
        setResult(nextResult)
        if (nextResult.ok) form.reset()
      } catch {
        setResult({
          ok: false,
          message: '圖片上傳失敗，請確認檔案不超過 5 MB 後再試一次。',
        })
      }
    })
  }

  return (
    <form className="admin-image-uploader" onSubmit={submit}>
      <h2>新增商品圖片</h2>
      <label>
        圖片
        <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
      </label>
      <label>
        圖片替代文字
        <input name="alt" required />
      </label>
      <button type="submit" disabled={pending}>{pending ? '上傳中…' : '上傳圖片'}</button>
      {result?.message && <p role="alert">{result.message}</p>}
      {result?.ok && <p role="status">圖片已上傳</p>}
    </form>
  )
}
