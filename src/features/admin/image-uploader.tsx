'use client'

import { useEffect, useState, useTransition } from 'react'
import { showToast } from '@/components/toast'
import { compressImageForUpload } from '@/lib/image-compression'

type UploadResult = { ok: boolean; message?: string }

export function ImageUploader({
  upload,
}: {
  upload: (formData: FormData) => Promise<UploadResult>
}) {
  const [result, setResult] = useState<UploadResult | null>(null)
  const [pending, startTransition] = useTransition()
  const [preview, setPreview] = useState('')
  const [fileName, setFileName] = useState('')

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    startTransition(async () => {
      try {
        const payload = new FormData(form)
        // Shrink oversized photos so tablet uploads stay within the limit.
        const picked = payload.get('file')
        if (picked instanceof File && picked.size > 0) {
          payload.set('file', await compressImageForUpload(picked))
        }
        const nextResult = await upload(payload)
        setResult(nextResult)
        if (nextResult.ok) {
          showToast(nextResult.message ?? '圖片已上傳，可繼續新增下一張')
          form.reset()
          setPreview('')
          setFileName('')
        }
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
      <header><div><p className="eyebrow">upload image</p><h2>新增商品圖片</h2></div><span>JPEG／PNG／WebP，單張 5 MB 以內</span></header>
      <label className="admin-image-dropzone" data-has-preview={Boolean(preview)}>
        <input aria-label="圖片" name="file" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => { const file = event.target.files?.[0]; if (preview) URL.revokeObjectURL(preview); setPreview(file ? URL.createObjectURL(file) : ''); setFileName(file?.name ?? '') }} />
        {preview ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="待上傳預覽" src={preview} /><strong>{fileName}</strong><span>點擊可重新選擇圖片</span>
        </> : <><b>＋</b><strong>選擇商品圖片</strong><span>建議使用直式 4:5 圖片，前台呈現最完整</span></>}
      </label>
      <label className="admin-image-alt">圖片替代文字<input aria-label="圖片替代文字" name="alt" placeholder="例：孩子穿著鼠尾草綠 T 恤的正面照" required /><small>這段文字會提供給看不到圖片的使用者，也有助於搜尋。</small></label>
      <button className="button" type="submit" disabled={pending}>{pending ? '圖片上傳中…' : '上傳圖片'}</button>
      {result?.message && !result.ok ? <p className="admin-upload-error" role="alert">{result.message}</p> : null}
    </form>
  )
}
