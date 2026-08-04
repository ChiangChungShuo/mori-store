'use client'

import { useEffect, useState, useTransition } from 'react'
import { showToast } from '@/components/toast'
import { compressImageForUpload } from '@/lib/image-compression'
import {
  applyWatermark,
  readWatermarkPreference,
  writeWatermarkPreference,
  type WatermarkPosition,
} from '@/lib/image-watermark'

type UploadResult = { ok: boolean; message?: string }

const positionLabels: Array<{ value: WatermarkPosition; label: string }> = [
  { value: 'bottom-right', label: '右下角' },
  { value: 'bottom-center', label: '下方中央' },
  { value: 'center', label: '正中央' },
]

export function ImageUploader({
  upload,
  colors = [],
}: {
  upload: (formData: FormData) => Promise<UploadResult>
  colors?: readonly string[]
}) {
  const [result, setResult] = useState<UploadResult | null>(null)
  const [pending, startTransition] = useTransition()
  const [preview, setPreview] = useState('')
  const [fileName, setFileName] = useState('')
  const [picked, setPicked] = useState<File | null>(null)
  const [watermark, setWatermark] = useState(() => readWatermarkPreference())

  useEffect(() => { writeWatermarkPreference(watermark) }, [watermark])

  // The preview shows exactly what will be stored: compressed, then stamped.
  // Clearing is handled where the file is cleared, so this effect only ever
  // publishes a freshly rendered preview.
  useEffect(() => {
    if (!picked) return
    let cancelled = false
    let url = ''
    void (async () => {
      const compressed = await compressImageForUpload(picked)
      const stamped = watermark.enabled && watermark.text.trim()
        ? await applyWatermark(compressed, { text: watermark.text, position: watermark.position })
        : compressed
      if (cancelled) return
      url = URL.createObjectURL(stamped)
      setPreview(url)
    })()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [picked, watermark])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    startTransition(async () => {
      try {
        const payload = new FormData(form)
        const file = payload.get('file')
        if (file instanceof File && file.size > 0) {
          // Shrink oversized photos first so the watermark is drawn at the
          // final size and stays crisp, then keep uploads within the limit.
          const compressed = await compressImageForUpload(file)
          payload.set('file', watermark.enabled && watermark.text.trim()
            ? await applyWatermark(compressed, { text: watermark.text, position: watermark.position })
            : compressed)
        }
        const nextResult = await upload(payload)
        setResult(nextResult)
        if (nextResult.ok) {
          showToast(nextResult.message ?? '圖片已上傳，可繼續新增下一張')
          form.reset()
          setPicked(null)
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
        <input aria-label="圖片" name="file" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => { const file = event.target.files?.[0] ?? null; setPicked(file); setFileName(file?.name ?? ''); if (!file) setPreview('') }} />
        {preview ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="待上傳預覽" src={preview} /><strong>{fileName}</strong><span>點擊可重新選擇圖片</span>
        </> : <><b>＋</b><strong>選擇商品圖片</strong><span>建議使用直式 4:5 圖片，前台呈現最完整</span></>}
      </label>

      <fieldset className="admin-watermark-fields">
        <legend>浮水印</legend>
        <label className="admin-watermark-toggle">
          <input checked={watermark.enabled} onChange={(event) => setWatermark({ ...watermark, enabled: event.target.checked })} type="checkbox" />
          上傳時加上浮水印
        </label>
        <label>文字<input disabled={!watermark.enabled} maxLength={24} onChange={(event) => setWatermark({ ...watermark, text: event.target.value })} value={watermark.text} /></label>
        <label>位置<select disabled={!watermark.enabled} onChange={(event) => setWatermark({ ...watermark, position: event.target.value as WatermarkPosition })} value={watermark.position}>
          {positionLabels.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <small>浮水印會直接印在存檔的圖片上，上方預覽就是顧客會看到的樣子；設定會記在這台裝置。</small>
      </fieldset>

      <label className="admin-image-color-field">對應顏色<select aria-label="對應顏色" name="color" defaultValue=""><option value="">共用圖片</option>{colors.map((color) => <option key={color} value={color}>{color}</option>)}</select><small>選擇顧客點擊這個顏色時要顯示的照片；細節照可保留共用。</small></label>
      <label className="admin-image-alt">圖片替代文字<input aria-label="圖片替代文字" name="alt" placeholder="例：孩子穿著鼠尾草綠 T 恤的正面照" required /><small>這段文字會提供給看不到圖片的使用者，也有助於搜尋。</small></label>
      <button className="button" type="submit" disabled={pending}>{pending ? '圖片上傳中…' : '上傳圖片'}</button>
      {result?.message && !result.ok ? <p className="admin-upload-error" role="alert">{result.message}</p> : null}
    </form>
  )
}
