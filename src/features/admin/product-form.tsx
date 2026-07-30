'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { availableAtError, getProductValidationErrors, productSchema, slugifyProductName, type ProductInput, type ProductVariantErrors } from '@/lib/validation/product'
import { VariantGrid } from './variant-grid'
import { defaultProductCategories } from '@/features/catalog/category-defaults'
import { AGE_BANDS } from '@/lib/age-bands'

const PRODUCT_DRAFT_KEY = 'mori-product-draft'

type ProductActionResult = {
  ok: boolean
  message?: string
  productId?: string
  fieldErrors?: Record<string, string[] | undefined>
  variantErrors?: ProductVariantErrors
}

type ProductFormProps = {
  initialProduct: ProductInput
  onSave: (product: ProductInput, image?: FormData) => Promise<ProductActionResult>
  requireImage?: boolean
  categories?: string[]
  materialPresets?: string[]
  carePresets?: string[]
}


function toDateTimeLocalValue(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function variantsAreComplete(variants: ProductInput['variants']) {
  const skus = variants.map((variant) => variant.sku.trim().toUpperCase())
  const combinations = variants.map((variant) => `${variant.color.trim()}::${variant.size.trim()}`)
  return variants.length > 0
    && variants.every((variant) => (
      Boolean(variant.sku.trim() && variant.color.trim() && variant.size.trim())
      && Number.isInteger(variant.price) && variant.price >= 0
      && (variant.cost === undefined || (Number.isInteger(variant.cost) && variant.cost >= 0))
      && Number.isInteger(variant.stock) && variant.stock >= 0
      && (variant.compareAtPrice === undefined || (Number.isInteger(variant.compareAtPrice) && variant.compareAtPrice >= variant.price))
    ))
    && new Set(skus).size === skus.length
    && new Set(combinations).size === combinations.length
}

export function ProductPublishForm({
  isPublished,
  onToggle,
  compact = false,
}: {
  isPublished: boolean
  onToggle: (published: boolean) => Promise<ProductActionResult>
  compact?: boolean
}) {
  const [result, setResult] = useState<ProductActionResult | null>(null)
  const [published, setPublished] = useState(isPublished)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!result?.message) return
    const timer = window.setTimeout(() => setResult(null), 2400)
    return () => window.clearTimeout(timer)
  }, [result])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const nextResult = await onToggle(!published)
      setResult(nextResult)
      if (nextResult.ok) setPublished((current) => !current)
    })
  }

  return (
    <form className={compact ? 'admin-publish-form admin-publish-form-compact' : 'admin-publish-form'} onSubmit={submit}>
      {!compact ? <span className="status-badge" data-status={published ? 'paid' : 'pending_payment'}>{published ? '已上架' : '草稿'}</span> : null}
      <button className={compact ? 'admin-inline-action' : 'button button-secondary'} type="submit" disabled={pending}>
        {pending ? '處理中…' : compact ? (published ? '下架' : '上架') : (published ? '下架商品' : '上架商品')}
      </button>
      {!result?.ok && result?.message && <p className="admin-action-toast" role="alert">{result.message}</p>}
      {result?.ok && result.message && <p className="admin-action-toast" role="status">{result.message}</p>}
    </form>
  )
}

export function DeleteProductForm({ onDelete }: { onDelete: () => Promise<ProductActionResult> }) {
  const router = useRouter()
  const [result, setResult] = useState<ProductActionResult | null>(null)
  const [pending, startTransition] = useTransition()
  return <form onSubmit={(event) => {
    event.preventDefault()
    if (!window.confirm('確定刪除這件商品？刪除後無法復原。')) return
    startTransition(async () => {
      const nextResult = await onDelete()
      setResult(nextResult)
      if (nextResult.ok) window.setTimeout(() => router.refresh(), 900)
    })
  }}><button className="admin-inline-action admin-delete-action" disabled={pending} type="submit">{pending ? '刪除中…' : '刪除'}</button>{result?.message ? <p className="admin-action-toast" role={result.ok ? 'status' : 'alert'}>{result.message}</p> : null}</form>
}

export function DeleteProductImageForm({
  imageNumber,
  onDelete,
}: {
  imageNumber: number
  onDelete: () => Promise<ProductActionResult>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return <form className="admin-image-delete-form" onSubmit={(event) => {
    event.preventDefault()
    if (!window.confirm(`確定刪除第 ${imageNumber} 張商品圖片？`)) return
    startTransition(async () => {
      const nextResult = await onDelete()
      if (nextResult.ok) router.refresh()
    })
  }}><button aria-label={`刪除圖片 ${imageNumber}`} disabled={pending} type="submit">{pending ? '刪除中…' : '刪除圖片'}</button></form>
}

export function ProductForm({ initialProduct, onSave, requireImage = false, categories = [...defaultProductCategories], materialPresets = [], carePresets = [] }: ProductFormProps) {
  const [product, setProduct] = useState(initialProduct)
  const [slugEdited, setSlugEdited] = useState(Boolean(initialProduct.slug))
  const [result, setResult] = useState<ProductActionResult | null>(null)
  const [pending, startTransition] = useTransition()
  const [attempted, setAttempted] = useState(false)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imageAlt, setImageAlt] = useState('')
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [minimumAvailableAt] = useState(() => toDateTimeLocalValue(new Date()))
  const imagePreviewsRef = useRef<string[]>([])

  useEffect(() => { imagePreviewsRef.current = imagePreviews }, [imagePreviews])
  useEffect(() => () => { imagePreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview)) }, [])

  useEffect(() => {
    if (requireImage || !result?.ok) return
    const timer = window.setTimeout(() => setResult(null), 2600)
    return () => window.clearTimeout(timer)
  }, [requireImage, result])

  const contentComplete = Boolean(
    product.name.trim()
    && product.category.trim()
    && product.ageBands.length
    && product.description.trim()
    && product.material.trim()
    && product.sizeGuide.trim()
    && product.careInstructions.trim()
  )
  const variantsComplete = variantsAreComplete(product.variants)
  const imageComplete = Boolean(imageFiles.length && imageAlt.trim())
  const activeStep = !contentComplete ? 1 : !variantsComplete ? 2 : !imageComplete ? 3 : 4
  const progress = [contentComplete, variantsComplete, imageComplete].filter(Boolean).length / 3 * 100

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setAttempted(true)
    const contentErrors: Record<string, string[]> = {}
    if (!product.description.trim()) contentErrors.description = ['請填寫商品說明']
    if (!product.material.trim()) contentErrors.material = ['請填寫商品材質']
    if (!product.sizeGuide.trim()) contentErrors.sizeGuide = ['請填寫尺寸指南']
    if (!product.careInstructions.trim()) contentErrors.careInstructions = ['請填寫洗滌說明']
    if (Object.keys(contentErrors).length > 0) {
      setResult({ ok: false, message: '商品內容尚未完成，請依紅色提示補齊。', fieldErrors: contentErrors })
      window.requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    if (requireImage && (!imageFiles.length || !imageAlt.trim())) {
      setResult({ ok: false, message: !imageFiles.length ? '請選擇至少一張商品圖片。' : '請填寫圖片說明。' })
      window.requestAnimationFrame(() => form.querySelector<HTMLElement>(!imageFiles.length ? '[name="file"]' : '[name="alt"]')?.focus())
      return
    }
    const parsed = productSchema.safeParse(product)
    if (!parsed.success) {
      const validationErrors = getProductValidationErrors(parsed.error)
      setResult({ ok: false, message: '還有必填資料未完成，請依紅色提示補齊。', ...validationErrors })
      window.requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    const scheduleError = availableAtError(product.availableAt, initialProduct.availableAt ?? null)
    if (scheduleError) {
      setResult({ ok: false, message: '還有必填資料未完成，請依紅色提示補齊。', fieldErrors: { availableAt: [scheduleError] } })
      window.requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    startTransition(async () => {
      let outcome: ProductActionResult
      if (!requireImage) {
        outcome = await onSave(parsed.data)
      } else {
        const imageData = new FormData()
        imageFiles.forEach((file) => imageData.append('file', file))
        imageData.set('alt', imageAlt)
        outcome = await onSave(parsed.data, imageData)
      }
      setResult(outcome)
      if (outcome.ok) {
        try { window.localStorage.removeItem(PRODUCT_DRAFT_KEY) } catch { /* ignore */ }
      }
    })
  }

  function setText(field: 'name' | 'slug' | 'category' | 'description' | 'summary' | 'seoTitle' | 'seoDescription' | 'material' | 'careInstructions' | 'sizeGuide', value: string) {
    setResult(null)
    if (field === 'slug') setSlugEdited(value.trim().length > 0)
    setProduct((current) => {
      // Auto-fill the slug from the name until the admin edits it themselves.
      if (field === 'name' && !slugEdited) {
        return { ...current, name: value, slug: slugifyProductName(value) }
      }
      return { ...current, [field]: value }
    })
  }

  function setTags(value: string) {
    setResult(null)
    const tags = value.split(/[,，、\n]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 20)
    setProduct((current) => ({ ...current, tags }))
  }

  function saveDraft() {
    try {
      window.localStorage.setItem(PRODUCT_DRAFT_KEY, JSON.stringify({ product, imageAlt }))
      setResult({ ok: true, message: '草稿已儲存到這台裝置（圖片需在完成時重新選擇）。' })
    } catch {
      setResult({ ok: false, message: '無法儲存草稿，請確認瀏覽器允許儲存。' })
    }
  }

  function restoreDraft() {
    try {
      const raw = window.localStorage.getItem(PRODUCT_DRAFT_KEY)
      if (!raw) { setResult({ ok: false, message: '找不到已儲存的草稿。' }); return }
      const draft = JSON.parse(raw) as { product?: ProductInput; imageAlt?: string }
      if (draft.product) {
        setProduct(draft.product)
        setSlugEdited(Boolean(draft.product.slug))
      }
      if (typeof draft.imageAlt === 'string') setImageAlt(draft.imageAlt)
      setResult({ ok: true, message: '已還原草稿，請重新選擇商品圖片後再建立。' })
    } catch {
      setResult({ ok: false, message: '草稿資料毀損，無法還原。' })
    }
  }

  function applyPreset(field: 'material' | 'careInstructions', value: string) {
    setResult(null)
    setProduct((current) => {
      const existing = current[field].trim()
      const separator = field === 'careInstructions' ? '\n' : '、'
      return { ...current, [field]: existing ? `${existing}${separator}${value}` : value }
    })
  }

  function toggleAgeBand(ageBand: ProductInput['ageBands'][number], checked: boolean) {
    setResult(null)
    setProduct((current) => ({
      ...current,
      ageBands: checked
        ? [...current.ageBands, ageBand]
        : current.ageBands.filter((candidate) => candidate !== ageBand),
    }))
  }

  return (
    <form className="admin-product-form" onSubmit={submit} noValidate>
      {requireImage ? <div className="admin-product-progress"><div className="admin-product-steps" aria-label="商品建立流程"><span data-active={activeStep === 1} data-complete={activeStep > 1}>01 商品內容</span><span data-active={activeStep === 2} data-complete={activeStep > 2}>02 規格庫存</span><span data-active={activeStep === 3} data-complete={activeStep > 3}>03 商品圖片</span><span data-active={activeStep === 4}>04 確認建立</span></div><div aria-label="商品建立進度" aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(progress)} className="admin-product-progress-meter" role="progressbar"><i style={{ width: `${progress}%` }} /></div></div> : null}
      <div className="admin-product-form-layout">
        <div className="admin-product-form-main">
          <section className="admin-form-card">
            <header><div><span>01</span><h2>基本資料</h2></div><p>顧客會先看到名稱、分類與適用年齡。</p></header>
            <div className="admin-form-grid">
              <label className="admin-field-wide">商品名稱<input aria-invalid={attempted && Boolean(result?.fieldErrors?.name)} value={product.name} onChange={(event) => setText('name', event.target.value)} placeholder="例：有機棉小樹 T 恤" required />{result?.fieldErrors?.name && <small>{result.fieldErrors.name[0]}</small>}</label>
              <label>網址代稱（留空自動產生）<input aria-invalid={attempted && Boolean(result?.fieldErrors?.slug)} value={product.slug} onChange={(event) => setText('slug', event.target.value)} placeholder="留空會依商品名稱自動產生" />{result?.fieldErrors?.slug && <small>{result.fieldErrors.slug[0]}</small>}<small className="admin-field-hint">商品的網址代稱，留空系統會自動產生；也可自訂英文小寫、數字與連字號，例如 mori-tree-tee</small></label>
              <div className="admin-form-field admin-category-field"><label htmlFor="product-category">分類</label><select id="product-category" aria-invalid={attempted && Boolean(result?.fieldErrors?.category)} value={product.category} onChange={(event) => setText('category', event.target.value)} required><option value="">請選擇分類</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>{result?.fieldErrors?.category && <small>{result.fieldErrors.category[0]}</small>}<Link className="admin-field-link" href="/admin/categories" target="_blank">管理分類 <span aria-hidden="true">↗</span></Link></div>
              <label>預約開賣時間（選填）<input aria-invalid={attempted && Boolean(result?.fieldErrors?.availableAt)} min={minimumAvailableAt} suppressHydrationWarning type="datetime-local" value={product.availableAt ? toDateTimeLocalValue(product.availableAt) : ''} onChange={(event) => { setResult(null); setProduct((current) => ({ ...current, availableAt: event.target.value ? new Date(event.target.value).toISOString() : null })) }} />{result?.fieldErrors?.availableAt && <small>{result.fieldErrors.availableAt[0]}</small>}<small className="admin-field-hint">只能選擇現在之後的時間；開賣前商品可瀏覽、不可購買。</small></label>
            </div>
            <fieldset className="admin-age-fieldset"><legend>適用年齡</legend><div>{AGE_BANDS.map((band) => <label key={band.value} data-selected={product.ageBands.includes(band.value)}><input type="checkbox" checked={product.ageBands.includes(band.value)} onChange={(event) => toggleAgeBand(band.value, event.target.checked)} /><strong>{band.label}</strong><span>{band.range}</span></label>)}</div>{result?.fieldErrors?.ageBands && <small>{result.fieldErrors.ageBands[0]}</small>}</fieldset>
          </section>

          <section className="admin-form-card">
            <header><div><span>02</span><h2>商品內容</h2></div><p>說清楚穿著感、材質與照顧方式。</p></header>
            <div className="admin-form-grid">
              <label className="admin-field-wide">簡短描述（選填）<textarea aria-invalid={attempted && Boolean(result?.fieldErrors?.summary)} value={product.summary ?? ''} onChange={(event) => setText('summary', event.target.value)} placeholder="一句話突出主要賣點，會顯示在商品列表卡片上" rows={2} maxLength={200} />{result?.fieldErrors?.summary && <small>{result.fieldErrors.summary[0]}</small>}<small className="admin-field-hint">最多 200 字；留白時列表會改用完整說明開頭。</small></label>
              <label className="admin-field-wide">商品說明<textarea aria-invalid={attempted && Boolean(result?.fieldErrors?.description)} value={product.description} onChange={(event) => setText('description', event.target.value)} placeholder="描述版型、觸感與適合的穿著情境（可換行分段）" rows={5} required />{result?.fieldErrors?.description && <small>{result.fieldErrors.description[0]}</small>}</label>
              <label>材質<input aria-invalid={attempted && Boolean(result?.fieldErrors?.material)} value={product.material} onChange={(event) => setText('material', event.target.value)} placeholder="例：100% 有機棉" required />{result?.fieldErrors?.material && <small>{result.fieldErrors.material[0]}</small>}</label>
              {materialPresets.length ? <div className="admin-preset-chips admin-field-wide"><span>常用材質：</span>{materialPresets.map((preset) => <button type="button" key={preset} onClick={() => applyPreset('material', preset)}>＋ {preset}</button>)}</div> : null}
              <label>尺寸指南<textarea aria-invalid={attempted && Boolean(result?.fieldErrors?.sizeGuide)} value={product.sizeGuide} onChange={(event) => setText('sizeGuide', event.target.value)} placeholder="例：正常版型，依平常尺寸選購" rows={3} required />{result?.fieldErrors?.sizeGuide && <small>{result.fieldErrors.sizeGuide[0]}</small>}</label>
              <label className="admin-field-wide">洗滌說明<textarea aria-invalid={attempted && Boolean(result?.fieldErrors?.careInstructions)} value={product.careInstructions} onChange={(event) => setText('careInstructions', event.target.value)} placeholder="例：反面裝洗衣袋，冷水柔洗並自然晾乾" rows={3} required />{result?.fieldErrors?.careInstructions && <small>{result.fieldErrors.careInstructions[0]}</small>}</label>
              {carePresets.length ? <div className="admin-preset-chips admin-field-wide"><span>常用洗滌說明：</span>{carePresets.map((preset) => <button type="button" key={preset} onClick={() => applyPreset('careInstructions', preset)}>＋ {preset}</button>)}</div> : null}
              <label className="admin-field-wide">標籤（選填）<input aria-invalid={attempted && Boolean(result?.fieldErrors?.tags)} value={(product.tags ?? []).join('、')} onChange={(event) => setTags(event.target.value)} placeholder="例：休閒、夏日、純棉（用、或逗號分隔）" />{result?.fieldErrors?.tags && <small>{result.fieldErrors.tags[0]}</small>}<small className="admin-field-hint">用頓號或逗號分隔，最多 20 個；顯示在商品頁，方便顧客瀏覽。</small></label>
            </div>
          </section>

          <section className="admin-form-card">
            <header><div><span>＋</span><h2>SEO 設定（選填）</h2></div><p>設定搜尋引擎顯示的標題與描述，未填則自動使用商品名稱與說明。</p></header>
            <div className="admin-form-grid">
              <label className="admin-field-wide">SEO 標題<input aria-invalid={attempted && Boolean(result?.fieldErrors?.seoTitle)} value={product.seoTitle ?? ''} onChange={(event) => setText('seoTitle', event.target.value)} placeholder="例：有機棉小樹 T 恤 - mori 童裝" maxLength={70} />{result?.fieldErrors?.seoTitle && <small>{result.fieldErrors.seoTitle[0]}</small>}<small className="admin-field-hint">建議格式「商品名稱 - 品牌」，約 70 字內。</small></label>
              <label className="admin-field-wide">SEO 描述<textarea aria-invalid={attempted && Boolean(result?.fieldErrors?.seoDescription)} value={product.seoDescription ?? ''} onChange={(event) => setText('seoDescription', event.target.value)} placeholder="吸引點擊的一段介紹，約 120–160 字" rows={3} maxLength={160} />{result?.fieldErrors?.seoDescription && <small>{result.fieldErrors.seoDescription[0]}</small>}</label>
            </div>
          </section>

          <section className="admin-form-card admin-variants-card">
            <header><div><span>03</span><h2>規格與庫存</h2></div><p>每個顏色與尺寸都需要獨立 SKU、售價和庫存。</p></header>
            <VariantGrid variants={product.variants} onChange={(variants) => { setResult(null); setProduct((current) => ({ ...current, variants })) }} errors={attempted ? result?.variantErrors : undefined} />
            {attempted && result?.fieldErrors?.variants ? <p className="admin-variant-error" role="alert">請修正上方紅色標示的規格欄位；只建立一種規格也可以儲存。</p> : null}
          </section>

          {requireImage ? <section className="admin-form-card admin-create-image-card">
            <header><div><span>04</span><h2>商品主圖</h2></div><p>建立商品時一起上傳，儲存後就能直接預覽；其他角度可在編輯頁繼續新增。</p></header>
            <label className="admin-image-dropzone" data-has-preview={imagePreviews.length > 0}>
              <input aria-label="商品圖片" name="file" type="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                imagePreviews.forEach((preview) => URL.revokeObjectURL(preview))
                setImageFiles(files)
                setImagePreviews(files.map((file) => URL.createObjectURL(file)))
                setResult(null)
                event.currentTarget.value = ''
              }} />
              {imagePreviews[0] ? <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="商品圖片預覽" src={imagePreviews[0]} /><strong>已選擇 {imageFiles.length} 張圖片</strong><span>第一張會作為主圖；點擊可重新選擇</span>
              </> : <><b>＋</b><strong>選擇商品圖片</strong><span>可一次選多張；JPEG／PNG／WebP，單張 5 MB 以內</span></>}
            </label>
            {imagePreviews.length ? <div className="admin-create-image-previews" aria-label="已選擇的商品圖片">{imagePreviews.map((preview, index) => <figure key={preview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`商品圖片預覽 ${index + 1}`} src={preview} /><figcaption>{index === 0 ? '主圖' : `${index + 1}`}</figcaption><button aria-label={`移除待上傳圖片 ${index + 1}`} type="button" onClick={() => {
                URL.revokeObjectURL(preview)
                setImageFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
                setImagePreviews((current) => current.filter((_, previewIndex) => previewIndex !== index))
                setResult(null)
              }}>×</button>
            </figure>)}</div> : null}
            <label className="admin-image-alt">圖片說明<input aria-label="圖片說明" name="alt" value={imageAlt} onChange={(event) => { setImageAlt(event.target.value); setResult(null) }} placeholder="例：孩子穿著鼠尾草綠 T 恤的正面照" required /><small>提供給看不到圖片的使用者，也有助於搜尋。</small></label>
          </section> : null}
        </div>

        <aside className="admin-product-form-aside">
          <section><p className="eyebrow">publish check</p><h2>儲存前檢查</h2><ul><li data-complete={contentComplete}>商品內容</li><li data-complete={variantsComplete}>規格與庫存</li>{requireImage ? <li data-complete={imageComplete}>商品圖片與說明</li> : null}{requireImage ? <li data-complete={activeStep === 4}>可以建立商品</li> : null}</ul></section>
          <label className="admin-new-toggle"><input type="checkbox" checked={product.isNew} onChange={(event) => setProduct((current) => ({ ...current, isNew: event.target.checked }))} /><span><strong>標記為新品</strong><small>在前台商品卡顯示 NEW ARRIVAL</small></span></label>
          <p className="admin-draft-note">{requireImage ? '商品資料、規格與主圖會一次建立。建立後先保留為草稿，確認內容無誤再上架。' : '儲存修改不會自動變更目前的上架狀態。'}</p>
        </aside>
      </div>
      <div className="admin-product-savebar">
        <div>{result?.ok ? <p className="admin-save-success" role={requireImage ? 'status' : undefined}>{result.message ?? '商品已儲存'}</p> : result?.message ? <p className="admin-save-error" role="alert">{result.message}</p> : null}</div>
        <div className="admin-savebar-actions">
          {requireImage ? <>
            <button type="button" className="button button-secondary" onClick={saveDraft}>儲存草稿</button>
            <button type="button" className="button button-secondary" onClick={restoreDraft}>還原草稿</button>
          </> : null}
          <button aria-label={requireImage ? '儲存並建立商品' : '儲存商品'} className="button" type="submit" disabled={pending}>{pending ? '儲存中…' : requireImage ? '儲存並建立商品' : '儲存商品'}</button>
        </div>
      </div>
      {requireImage && result?.ok && result.productId ? <div className="admin-success-modal" role="dialog" aria-modal="true" aria-labelledby="product-create-success-title">
        <div>
          <span aria-hidden="true">✓</span>
          <p className="eyebrow">product created</p>
          <h2 id="product-create-success-title">商品建立完成</h2>
          <p>{result.message}，目前先保留為草稿。你可以繼續檢查內容，確認後再上架。</p>
          <div><Link className="button" href={`/admin/products/${result.productId}/edit`}>前往編輯商品</Link><Link className="button button-secondary" href="/admin/products">返回商品列表</Link></div>
        </div>
      </div> : null}
      {!requireImage && result?.ok ? <div className="admin-edit-save-toast" role="status"><span aria-hidden="true">✓</span><div><strong>{result.message ?? '商品修改已儲存'}</strong><small>前台與後台資料已同步更新</small></div></div> : null}
    </form>
  )
}
