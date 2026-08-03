'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { availableAtError, getProductValidationErrors, productSchema, slugifyProductName, type ProductInput, type ProductVariantErrors, type QuantityPriceErrors } from '@/lib/validation/product'
import { VariantGrid } from './variant-grid'
import { defaultProductCategories } from '@/features/catalog/category-defaults'
import { AGE_BANDS } from '@/lib/age-bands'
import { PREORDER_TAG, PREORDER_STOCK, isPreorder } from '@/lib/preorder'
import { ConfirmModal } from '@/components/confirm-modal'
import { showToast } from '@/components/toast'
import { compressImagesForUpload } from '@/lib/image-compression'
import type { SaveDraftState } from '@/features/admin/product-drafts'
import type { ProductSeries } from '@/features/catalog/product-series'
import { priceProductBundle } from '@/features/cart/bundle-pricing'
import { formatTwd } from '@/lib/money'

type ProductActionResult = {
  ok: boolean
  message?: string
  productId?: string
  fieldErrors?: Record<string, string[] | undefined>
  variantErrors?: ProductVariantErrors
  quantityPriceErrors?: QuantityPriceErrors
}

type ProductFormProps = {
  initialProduct: ProductInput
  onSave: (product: ProductInput, image?: FormData) => Promise<ProductActionResult>
  requireImage?: boolean
  categories?: string[]
  series?: ProductSeries[]
  materialPresets?: string[]
  carePresets?: string[]
  sizeOptions?: string[]
  draftId?: string | null
  draftImages?: string[]
  draftImageAlt?: string
  saveDraft?: (draftId: string | null, payload: FormData) => Promise<SaveDraftState>
  discardDraft?: (draftId: string) => Promise<void>
}


function toDateTimeLocalValue(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Human labels so submit-time errors can name the exact fields to fix.
const FIELD_LABELS: Record<string, string> = {
  name: '商品名稱',
  slug: '網址代稱',
  category: '分類',
  seriesIds: '商品系列',
  ageBands: '適用年齡',
  summary: '簡短描述',
  description: '商品說明',
  material: '材質',
  sizeGuide: '尺寸指南',
  careInstructions: '洗滌說明',
  tags: '標籤',
  availableAt: '預約開賣時間',
  quantityPrices: '多件優惠價',
}

const VARIANT_FIELD_LABELS: Record<string, string> = {
  sku: 'SKU',
  color: '顏色',
  size: '尺寸',
  price: '售價',
  cost: '成本',
  compareAtPrice: '原價',
  stock: '庫存',
}

function describeFieldErrors(
  fieldErrors?: Record<string, string[] | undefined>,
  variantErrors?: ProductVariantErrors,
): string {
  const names = Object.entries(fieldErrors ?? {})
    .filter(([, messages]) => messages && messages.length > 0)
    .map(([field]) => FIELD_LABELS[field] ?? field)
  const variantNames = (variantErrors ?? []).flatMap((row, index) => {
    if (!row) return []
    const fields = Object.keys(row)
      .filter((field) => row[field as keyof typeof row]?.length)
      .map((field) => VARIANT_FIELD_LABELS[field] ?? field)
    return fields.length ? [`規格 ${String(index + 1).padStart(2, '0')} 的${fields.join('、')}`] : []
  })
  const all = [...new Set([...names, ...variantNames])]
  return all.length ? `請修正：${all.join('、')}` : ''
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
  const [published, setPublished] = useState(isPublished)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const nextResult = await onToggle(!published)
      if (nextResult.message) showToast(nextResult.message, nextResult.ok)
      else if (nextResult.ok) showToast(published ? '商品已下架' : '商品已上架')
      if (nextResult.ok) setPublished((current) => !current)
    })
  }

  return (
    <form className={compact ? 'admin-publish-form admin-publish-form-compact' : 'admin-publish-form'} onSubmit={submit}>
      {!compact ? <span className="status-badge" data-status={published ? 'paid' : 'pending_payment'}>{published ? '已上架' : '草稿'}</span> : null}
      <button className={compact ? 'admin-inline-action' : 'button button-secondary'} type="submit" disabled={pending}>
        {pending ? '處理中…' : compact ? (published ? '下架' : '上架') : (published ? '下架商品' : '上架商品')}
      </button>
    </form>
  )
}

export function DeleteProductForm({ onDelete }: { onDelete: () => Promise<ProductActionResult> }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <form data-confirm="danger" onSubmit={(event) => {
    event.preventDefault()
    startTransition(async () => {
      const nextResult = await onDelete()
      showToast(nextResult.message ?? (nextResult.ok ? '商品已刪除' : '刪除失敗'), nextResult.ok)
      if (nextResult.ok) window.setTimeout(() => router.refresh(), 600)
    })
  }}><button className="admin-inline-action admin-delete-action" disabled={pending} type="submit">{pending ? '刪除中…' : '刪除'}</button></form>
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

  return <form className="admin-image-delete-form" data-confirm="danger" onSubmit={(event) => {
    event.preventDefault()
    startTransition(async () => {
      const nextResult = await onDelete()
      showToast(nextResult.message ?? (nextResult.ok ? '商品圖片已刪除' : '刪除失敗'), nextResult.ok)
      if (nextResult.ok) router.refresh()
    })
  }}><button aria-label={`刪除圖片 ${imageNumber}`} disabled={pending} type="submit">{pending ? '刪除中…' : '刪除圖片'}</button></form>
}

export function ProductImageOrderControls({
  imageNumber,
  onMoveEarlier,
  onMoveLater,
}: {
  imageNumber: number
  onMoveEarlier?: () => Promise<ProductActionResult>
  onMoveLater?: () => Promise<ProductActionResult>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function move(action?: () => Promise<ProductActionResult>) {
    if (!action) return
    startTransition(async () => {
      const nextResult = await action()
      showToast(nextResult.message ?? (nextResult.ok ? '商品圖片順序已更新' : '排序失敗'), nextResult.ok)
      if (nextResult.ok) router.refresh()
    })
  }

  return <div className="admin-image-order-controls" aria-label={`調整圖片 ${imageNumber} 順序`}>
    <button aria-label={`將圖片 ${imageNumber} 往前移`} disabled={pending || !onMoveEarlier} type="button" onClick={() => move(onMoveEarlier)}>← 往前</button>
    <button aria-label={`將圖片 ${imageNumber} 往後移`} disabled={pending || !onMoveLater} type="button" onClick={() => move(onMoveLater)}>往後 →</button>
  </div>
}

export function ProductImageColorForm({
  imageNumber,
  color,
  colors,
  onSave,
}: {
  imageNumber: number
  color: string | null
  colors: readonly string[]
  onSave: (color: string | null) => Promise<ProductActionResult>
}) {
  const router = useRouter()
  const [selected, setSelected] = useState(color ?? '')
  const [pending, startTransition] = useTransition()
  const hasLegacyColor = Boolean(color && !colors.includes(color))

  return <label className="admin-image-color-field">
    對應顏色
    <select aria-label={`圖片 ${imageNumber} 對應顏色`} disabled={pending} value={selected} onChange={(event) => {
      const nextColor = event.target.value
      setSelected(nextColor)
      startTransition(async () => {
        const outcome = await onSave(nextColor || null)
        showToast(outcome.message ?? (outcome.ok ? '圖片顏色已更新' : '更新失敗'), outcome.ok)
        if (outcome.ok) router.refresh()
        else setSelected(color ?? '')
      })
    }}>
      <option value="">共用圖片</option>
      {hasLegacyColor ? <option value={color!}>{color}（規格已移除）</option> : null}
      {colors.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
    </select>
  </label>
}

export function ProductForm({ initialProduct, onSave, requireImage = false, categories = [...defaultProductCategories], series = [], materialPresets = [], carePresets = [], sizeOptions = [], draftId: initialDraftId = null, draftImages: initialDraftImages = [], draftImageAlt: initialDraftImageAlt = '', saveDraft, discardDraft }: ProductFormProps) {
  const router = useRouter()
  const [product, setProduct] = useState<ProductInput>({ ...initialProduct, seriesIds: initialProduct.seriesIds ?? [], quantityPrices: initialProduct.quantityPrices ?? [] })
  const [draftId, setDraftId] = useState<string | null>(initialDraftId)
  const [preorder, setPreorder] = useState(isPreorder(initialProduct.tags))
  const [pendingSave, setPendingSave] = useState<ProductInput | null>(null)
  const [slugEdited, setSlugEdited] = useState(Boolean(initialProduct.slug))
  const [result, setResult] = useState<ProductActionResult | null>(null)
  const [pending, startTransition] = useTransition()
  const [attempted, setAttempted] = useState(false)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [compressing, setCompressing] = useState(false)
  const [draftImages, setDraftImages] = useState<string[]>(initialDraftImages)
  const [imageAlt, setImageAlt] = useState(initialDraftImageAlt)
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [imageColors, setImageColors] = useState<Array<string | null>>(
    () => initialDraftImages.map(() => null),
  )
  const [minimumAvailableAt] = useState(() => toDateTimeLocalValue(new Date()))
  const imagePreviewsRef = useRef<string[]>([])
  const availableSeries = series
    .filter((item) => item.categoryName === product.category)
    .sort((first, second) => first.position - second.position)
  const productColors = [...new Set(product.variants.map((variant) => variant.color.trim()).filter(Boolean))]

  useEffect(() => { imagePreviewsRef.current = imagePreviews }, [imagePreviews])
  useEffect(() => () => { imagePreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview)) }, [])


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
  const hasImages = imageFiles.length > 0 || draftImages.length > 0
  const imageComplete = Boolean(hasImages && imageAlt.trim())
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
      setResult({ ok: false, message: describeFieldErrors(contentErrors), fieldErrors: contentErrors })
      window.requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    if (requireImage && (!hasImages || !imageAlt.trim())) {
      setResult({
        ok: false,
        message: !hasImages ? '請選擇至少一張商品圖片。' : '請填寫圖片說明。',
        fieldErrors: hasImages ? { imageAlt: ['請填寫圖片說明'] } : { images: ['請選擇至少一張商品圖片'] },
      })
      window.requestAnimationFrame(() => form.querySelector<HTMLElement>(!hasImages ? '[name="file"]' : '[name="alt"]')?.focus())
      return
    }
    const parsed = productSchema.safeParse(product)
    if (!parsed.success) {
      const validationErrors = getProductValidationErrors(parsed.error)
      setResult({
        ok: false,
        message: describeFieldErrors(validationErrors.fieldErrors, validationErrors.variantErrors)
          || '還有必填資料未完成，請依紅色提示補齊。',
        ...validationErrors,
      })
      window.requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    const scheduleError = availableAtError(product.availableAt, initialProduct.availableAt ?? null)
    if (scheduleError) {
      setResult({ ok: false, message: `預約開賣時間：${scheduleError}`, fieldErrors: { availableAt: [scheduleError] } })
      window.requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    // Pre-order products stay sellable without real stock: force a high stock
    // on every variant. The 預購 tag itself is toggled onto product.tags.
    const finalProduct = preorder
      ? { ...parsed.data, variants: parsed.data.variants.map((variant) => ({ ...variant, stock: PREORDER_STOCK })) }
      : parsed.data
    // Validation passed — ask for confirmation before actually saving.
    setPendingSave(finalProduct)
  }

  function runSave() {
    const finalProduct = pendingSave
    if (!finalProduct) return
    setPendingSave(null)
    startTransition(async () => {
      let outcome: ProductActionResult
      if (!requireImage) {
        outcome = await onSave(finalProduct)
      } else {
        const imageData = new FormData()
        imageData.set('alt', imageAlt)
        imageData.set('imageColors', JSON.stringify(imageColors))
        if (imageFiles.length) {
          imageFiles.forEach((file) => imageData.append('file', file))
        } else {
          // Draft images already live in storage: send their paths so the server
          // copies them directly instead of pushing megabytes back through the
          // browser (which exceeds the server-action body limit).
          const marker = '/product-images/'
          const paths: string[] = []
          for (const [index, url] of draftImages.entries()) {
            const markerAt = url.indexOf(marker)
            if (markerAt !== -1) {
              paths.push(url.slice(markerAt + marker.length))
              continue
            }
            // Fixture/data URLs have no storage path; inline them as files.
            try {
              const blob = await (await fetch(url)).blob()
              const extension = blob.type.split('/')[1] ?? 'png'
              imageData.append('file', new File([blob], `draft-image-${index + 1}.${extension}`, { type: blob.type }))
            } catch {
              setResult({ ok: false, message: '無法讀取草稿圖片，請重新選擇圖片後再建立。' })
              return
            }
          }
          imageData.set('draftImagePaths', JSON.stringify(paths))
        }
        outcome = await onSave(finalProduct, imageData)
      }
      if (outcome.ok) {
        setResult(null)
        showToast(outcome.message ?? (requireImage ? '商品已建立，先保留為草稿' : '商品修改已儲存'))
        // The draft has become a real product — clean it (and its images) up.
        if (draftId && discardDraft) { try { await discardDraft(draftId) } catch { /* ignore */ } }
        // New products: return to the inventory list after a successful create.
        if (requireImage) router.push('/admin/products')
      } else {
        setResult(outcome)
        setAttempted(true)
        // Bring the offending field into view so a server-side conflict (e.g. a
        // duplicate SKU) is as visible as a client-side validation error.
        window.requestAnimationFrame(() => {
          const target = document.querySelector<HTMLElement>('.admin-product-form [aria-invalid="true"]')
          target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          target?.focus({ preventScroll: true })
        })
      }
    })
  }

  function setText(field: 'name' | 'slug' | 'category' | 'description' | 'summary' | 'material' | 'careInstructions' | 'sizeGuide', value: string) {
    setResult(null)
    if (field === 'slug') setSlugEdited(value.trim().length > 0)
    setProduct((current) => {
      // Auto-fill the slug from the name until the admin edits it themselves.
      if (field === 'name' && !slugEdited) {
        return { ...current, name: value, slug: slugifyProductName(value) }
      }
      if (field === 'category') {
        return current.category === value
          ? current
          : { ...current, category: value, seriesIds: [] }
      }
      return { ...current, [field]: value }
    })
  }

  function setTags(value: string) {
    setResult(null)
    const tags = value.split(/[,，、\n]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 20)
    setProduct((current) => ({ ...current, tags }))
  }

  function handleSaveDraft() {
    if (!saveDraft) return
    startTransition(async () => {
      const payload = new FormData()
      payload.set('product', JSON.stringify(product))
      payload.set('alt', imageAlt)
      payload.set('imageColors', JSON.stringify(imageColors))
      payload.set('existingImages', JSON.stringify(imageFiles.length ? [] : draftImages))
      imageFiles.forEach((file) => payload.append('file', file))
      const outcome = await saveDraft(draftId, payload)
      if (outcome.ok && outcome.id) setDraftId(outcome.id)
      showToast(outcome.message, outcome.ok)
    })
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

  function toggleSeries(seriesId: string, checked: boolean) {
    setResult(null)
    setProduct((current) => ({
      ...current,
      seriesIds: checked
        ? [...current.seriesIds, seriesId]
        : current.seriesIds.filter((candidate) => candidate !== seriesId),
    }))
  }

  function addQuantityTier() {
    setResult(null)
    setProduct((current) => {
      const used = new Set(current.quantityPrices.map((tier) => tier.quantity))
      let quantity = 2
      while (used.has(quantity) && quantity < 99) quantity += 1
      const cheapest = current.variants.reduce(
        (lowest, variant) => Math.min(lowest, variant.price || 0),
        Number.POSITIVE_INFINITY,
      )
      // Suggest a round 10%-off price so the owner only has to adjust it.
      const suggested = Number.isFinite(cheapest) && cheapest > 0
        ? Math.round((cheapest * quantity * 0.9) / 10) * 10
        : 0
      return {
        ...current,
        quantityPrices: [...current.quantityPrices, { quantity, bundlePrice: suggested }],
      }
    })
  }

  function updateQuantityTier(index: number, patch: Partial<ProductInput['quantityPrices'][number]>) {
    setResult(null)
    setProduct((current) => ({
      ...current,
      quantityPrices: current.quantityPrices.map((tier, tierIndex) => (
        tierIndex === index ? { ...tier, ...patch } : tier
      )),
    }))
  }

  function removeQuantityTier(index: number) {
    setResult(null)
    setProduct((current) => ({
      ...current,
      quantityPrices: current.quantityPrices.filter((_, tierIndex) => tierIndex !== index),
    }))
  }

  function updateImageColor(index: number, color: string | null) {
    setResult(null)
    setImageColors((current) => current.map((existing, imageIndex) => (
      imageIndex === index ? color : existing
    )))
  }

  const cheapestVariantPrice = product.variants.reduce(
    (lowest, variant) => Math.min(lowest, variant.price || Number.POSITIVE_INFINITY),
    Number.POSITIVE_INFINITY,
  )
  const exampleUnitPrice = Number.isFinite(cheapestVariantPrice) ? cheapestVariantPrice : 0
  // Shows the owner what the largest configured tier actually saves.
  const largestTier = product.quantityPrices.reduce<number>(
    (largest, tier) => Math.max(largest, tier.quantity),
    0,
  )
  const bundleExample = largestTier >= 2 && exampleUnitPrice > 0
    ? (() => {
      const pricing = priceProductBundle(
        [{ unitPrice: exampleUnitPrice, quantity: largestTier }],
        product.quantityPrices,
      )
      return pricing.discount > 0
        ? {
          quantity: largestTier,
          original: pricing.originalSubtotal,
          discounted: pricing.discountedSubtotal,
          saving: pricing.discount,
        }
        : null
    })()
    : null

  return (
    <form className="admin-product-form" data-no-confirm onSubmit={submit} noValidate>
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
            <fieldset className="admin-product-series" disabled={!product.category}>
              <legend>商品系列（可複選）</legend>
              {!product.category ? <p>請先選擇商品分類。</p> : availableSeries.length === 0 ? <p>此分類尚未建立系列。<Link href="/admin/categories" target="_blank">前往系列管理</Link></p> : <div className="admin-series-chips">{availableSeries.map((item) => {
                const selected = product.seriesIds.includes(item.id)
                return <button key={item.id} type="button" data-selected={selected} aria-pressed={selected} onClick={() => toggleSeries(item.id, !selected)}><span aria-hidden="true">{selected ? '✓' : '＋'}</span>{item.name}</button>
              })}</div>}
              {result?.fieldErrors?.seriesIds && <small>{result.fieldErrors.seriesIds[0]}</small>}
            </fieldset>
            <fieldset className="admin-age-fieldset"><legend>適用年齡</legend><div>{AGE_BANDS.map((band) => <label key={band.value} data-selected={product.ageBands.includes(band.value)}><input type="checkbox" checked={product.ageBands.includes(band.value)} onChange={(event) => toggleAgeBand(band.value, event.target.checked)} /><strong>{band.label}</strong><span>{band.range}</span></label>)}</div>{result?.fieldErrors?.ageBands && <small>{result.fieldErrors.ageBands[0]}</small>}</fieldset>
          </section>

          <section className="admin-form-card">
            <header><div><span>02</span><h2>商品內容</h2></div><p>說清楚穿著感、材質與照顧方式。</p></header>
            <div className="admin-form-grid">
              <label className="admin-field-wide">簡短描述（選填）<textarea aria-invalid={attempted && Boolean(result?.fieldErrors?.summary)} value={product.summary ?? ''} onChange={(event) => setText('summary', event.target.value)} placeholder="一句話突出主要賣點，會顯示在商品列表卡片上" rows={2} maxLength={200} />{result?.fieldErrors?.summary && <small>{result.fieldErrors.summary[0]}</small>}<small className="admin-field-hint">最多 200 字；留白時列表會改用完整說明開頭。</small></label>
              <label className="admin-field-wide">商品說明<textarea aria-invalid={attempted && Boolean(result?.fieldErrors?.description)} value={product.description} onChange={(event) => setText('description', event.target.value)} placeholder="描述版型、觸感與適合的穿著情境（可換行分段）" rows={5} required />{result?.fieldErrors?.description && <small>{result.fieldErrors.description[0]}</small>}</label>
              <label>材質<input aria-invalid={attempted && Boolean(result?.fieldErrors?.material)} value={product.material} onChange={(event) => setText('material', event.target.value)} placeholder="例：100% 有機棉" required />{result?.fieldErrors?.material && <small>{result.fieldErrors.material[0]}</small>}</label>
              {materialPresets.length ? <div className="admin-preset-chips admin-field-wide"><span>常用材質：</span>{materialPresets.map((preset) => <button type="button" key={preset} onClick={() => applyPreset('material', preset)}>＋ {preset}</button>)}</div> : null}
              <label className="admin-field-wide">實際平量、模特兒與版型資訊<textarea aria-label="尺寸指南" aria-invalid={attempted && Boolean(result?.fieldErrors?.sizeGuide)} value={product.sizeGuide} onChange={(event) => setText('sizeGuide', event.target.value)} placeholder={'例：\n版型：正常版型；喜歡寬鬆可拿大一號\n模特兒：身高 105 cm／體重 16 kg／穿 110\n90：衣長 38／胸寬 35 cm\n100：衣長 41／胸寬 37 cm'} rows={7} required />{result?.fieldErrors?.sizeGuide && <small>{result.fieldErrors.sizeGuide[0]}</small>}<small className="admin-field-hint">請依品項填衣長、胸寬、腰寬、褲長等實際平量，並補上模特兒身高、體重與穿著尺寸。</small></label>
              <label className="admin-field-wide">洗滌說明<textarea aria-invalid={attempted && Boolean(result?.fieldErrors?.careInstructions)} value={product.careInstructions} onChange={(event) => setText('careInstructions', event.target.value)} placeholder="例：反面裝洗衣袋，冷水柔洗並自然晾乾" rows={3} required />{result?.fieldErrors?.careInstructions && <small>{result.fieldErrors.careInstructions[0]}</small>}</label>
              {carePresets.length ? <div className="admin-preset-chips admin-field-wide"><span>常用洗滌說明：</span>{carePresets.map((preset) => <button type="button" key={preset} onClick={() => applyPreset('careInstructions', preset)}>＋ {preset}</button>)}</div> : null}
              <label className="admin-field-wide">標籤（選填）<input aria-invalid={attempted && Boolean(result?.fieldErrors?.tags)} value={(product.tags ?? []).join('、')} onChange={(event) => setTags(event.target.value)} placeholder="例：熱賣、休閒、夏日、純棉（用、或逗號分隔）" />{result?.fieldErrors?.tags && <small>{result.fieldErrors.tags[0]}</small>}<small className="admin-field-hint">用頓號或逗號分隔，最多 20 個；加入「熱賣」後，商品會出現在前台的「本週熱賣」，商品卡也會標上熱賣標籤。</small></label>
            </div>
          </section>

          <section className="admin-form-card admin-variants-card">
            <header><div><span>03</span><h2>規格與庫存</h2></div><p>每個顏色與尺寸都需要獨立 SKU、售價和庫存。</p></header>
            <VariantGrid variants={product.variants} onChange={(variants) => { setResult(null); setProduct((current) => ({ ...current, variants })) }} errors={attempted ? result?.variantErrors : undefined} sizeOptions={sizeOptions} />
            {attempted && result?.fieldErrors?.variants ? <p className="admin-variant-error" role="alert">請修正上方紅色標示的規格欄位；只建立一種規格也可以儲存。</p> : null}
          </section>

          <section className="admin-form-card admin-quantity-price-card">
            <header><div><span>＋</span><h2>多件優惠價（選填）</h2></div><p>設定「任選 N 件多少錢」，顧客不需輸入優惠碼，購物車會自動算最便宜的組合。同一商品的不同顏色與尺寸可以混搭。</p></header>
            {product.quantityPrices.length === 0
              ? <p className="admin-panel-note">尚未設定多件優惠。例如單件 {formatTwd(exampleUnitPrice)}，可設定「任選 2 件」與「任選 3 件」的組合價。</p>
              : <div className="admin-quantity-price-rows">
                {product.quantityPrices.map((tier, index) => {
                  const rowErrors = attempted ? result?.quantityPriceErrors?.[index] : undefined
                  const preview = exampleUnitPrice > 0
                    ? exampleUnitPrice * tier.quantity - tier.bundlePrice
                    : 0
                  return (
                    <div className="admin-quantity-price-row" key={index}>
                      <label>任選件數
                        <input aria-invalid={Boolean(rowErrors?.quantity)} min={2} max={99} type="number" value={tier.quantity} onChange={(event) => updateQuantityTier(index, { quantity: Number(event.target.value) })} />
                        {rowErrors?.quantity && <small>{rowErrors.quantity[0]}</small>}
                      </label>
                      <label>組合價
                        <input aria-invalid={Boolean(rowErrors?.bundlePrice)} min={0} type="number" value={tier.bundlePrice} onChange={(event) => updateQuantityTier(index, { bundlePrice: Number(event.target.value) })} />
                        {rowErrors?.bundlePrice && <small>{rowErrors.bundlePrice[0]}</small>}
                      </label>
                      <p className="admin-quantity-price-preview">{preview > 0 ? `每件約 ${formatTwd(Math.round(tier.bundlePrice / tier.quantity))}，省 ${formatTwd(preview)}` : '組合價需低於單買總額'}</p>
                      <button type="button" className="admin-quantity-price-remove" onClick={() => removeQuantityTier(index)} aria-label={`移除任選 ${tier.quantity} 件的優惠`}>移除</button>
                    </div>
                  )
                })}
              </div>}
            <div className="admin-quantity-price-actions">
              <button type="button" onClick={addQuantityTier} disabled={product.quantityPrices.length >= 10}>＋ 新增件數階梯</button>
              {bundleExample ? <p className="admin-quantity-price-example">試算：買 {bundleExample.quantity} 件原價 {formatTwd(bundleExample.original)}，優惠後 {formatTwd(bundleExample.discounted)}（省 {formatTwd(bundleExample.saving)}）</p> : null}
            </div>
            {attempted && result?.fieldErrors?.quantityPrices ? <p className="admin-variant-error" role="alert">{result.fieldErrors.quantityPrices[0]}</p> : null}
          </section>

          {requireImage ? <section className="admin-form-card admin-create-image-card">
            <header><div><span>04</span><h2>商品主圖</h2></div><p>建立商品時一起上傳，儲存後就能直接預覽；其他角度可在編輯頁繼續新增。</p></header>
            <label className="admin-image-dropzone" data-has-preview={imagePreviews.length > 0 || draftImages.length > 0}>
              <input aria-label="商品圖片" name="file" type="file" accept="image/jpeg,image/png,image/webp" multiple required={!draftImages.length} onChange={(event) => {
                const selected = Array.from(event.target.files ?? [])
                event.currentTarget.value = ''
                if (!selected.length) return
                setResult(null)
                setCompressing(true)
                // Shrink phone/tablet photos before preview or upload: full-size
                // originals exhaust tablet memory and exceed the upload limit.
                void compressImagesForUpload(selected).then((files) => {
                  imagePreviews.forEach((preview) => URL.revokeObjectURL(preview))
                  setImageFiles(files)
                  setImagePreviews(files.map((file) => URL.createObjectURL(file)))
                  setImageColors(files.map(() => null))
                  setDraftImages([])
                  setCompressing(false)
                })
              }} />
              {compressing ? <><b>⋯</b><strong>正在處理圖片…</strong><span>大張照片會自動縮小，請稍候</span></> : imagePreviews[0] ? <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="商品圖片預覽" src={imagePreviews[0]} /><strong>已選擇 {imageFiles.length} 張圖片</strong><span>第一張會作為主圖；點擊可重新選擇</span>
              </> : draftImages[0] ? <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="草稿商品圖片預覽" src={draftImages[0]} /><strong>草稿已保存 {draftImages.length} 張圖片</strong><span>建立商品時會使用這些圖片；點擊可重新選擇</span>
              </> : <><b>＋</b><strong>選擇商品圖片</strong><span>可一次選多張；JPEG／PNG／WebP，單張 5 MB 以內</span></>}
            </label>
            {!imagePreviews.length && draftImages.length ? <div className="admin-create-image-previews" aria-label="草稿保存的商品圖片">{draftImages.map((url, index) => <figure key={url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`草稿圖片 ${index + 1}`} src={url} /><figcaption>{index === 0 ? '主圖' : `${index + 1}`}</figcaption><label className="admin-image-color-field">圖片 {index + 1} 對應顏色<select aria-label={`圖片 ${index + 1} 對應顏色`} value={imageColors[index] ?? ''} onChange={(event) => updateImageColor(index, event.target.value || null)}><option value="">共用圖片</option>{productColors.map((color) => <option key={color} value={color}>{color}</option>)}</select></label><button aria-label={`移除草稿圖片 ${index + 1}`} type="button" onClick={() => {
                setDraftImages((current) => current.filter((_, imageIndex) => imageIndex !== index))
                setImageColors((current) => current.filter((_, imageIndex) => imageIndex !== index))
                setResult(null)
              }}>×</button>
            </figure>)}</div> : null}
            {imagePreviews.length ? <div className="admin-create-image-previews" aria-label="已選擇的商品圖片">{imagePreviews.map((preview, index) => <figure key={preview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`商品圖片預覽 ${index + 1}`} src={preview} /><figcaption>{index === 0 ? '主圖' : `${index + 1}`}</figcaption><label className="admin-image-color-field">圖片 {index + 1} 對應顏色<select aria-label={`圖片 ${index + 1} 對應顏色`} value={imageColors[index] ?? ''} onChange={(event) => updateImageColor(index, event.target.value || null)}><option value="">共用圖片</option>{productColors.map((color) => <option key={color} value={color}>{color}</option>)}</select></label><button aria-label={`移除待上傳圖片 ${index + 1}`} type="button" onClick={() => {
                URL.revokeObjectURL(preview)
                setImageFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
                setImagePreviews((current) => current.filter((_, previewIndex) => previewIndex !== index))
                setImageColors((current) => current.filter((_, colorIndex) => colorIndex !== index))
                setResult(null)
              }}>×</button>
            </figure>)}</div> : null}
            <label className="admin-image-alt">圖片說明<input aria-invalid={attempted && Boolean(result?.fieldErrors?.imageAlt)} aria-label="圖片說明" name="alt" value={imageAlt} onChange={(event) => { setImageAlt(event.target.value); setResult(null) }} placeholder="例：孩子穿著鼠尾草綠 T 恤的正面照" required />{result?.fieldErrors?.imageAlt && <small className="admin-field-error">{result.fieldErrors.imageAlt[0]}</small>}<small>提供給看不到圖片的使用者，也有助於搜尋。</small></label>
          </section> : null}
        </div>

        <aside className="admin-product-form-aside">
          <section><p className="eyebrow">publish check</p><h2>儲存前檢查</h2><ul><li data-complete={contentComplete}>商品內容</li><li data-complete={variantsComplete}>規格與庫存</li>{requireImage ? <li data-complete={imageComplete}>商品圖片與說明</li> : null}{requireImage ? <li data-complete={activeStep === 4}>可以建立商品</li> : null}</ul></section>
          <label className="admin-new-toggle"><input type="checkbox" checked={product.isNew} onChange={(event) => setProduct((current) => ({ ...current, isNew: event.target.checked }))} /><span><strong>標記為新品</strong><small>在前台商品卡顯示 NEW ARRIVAL</small></span></label>
          <label className="admin-new-toggle"><input type="checkbox" checked={preorder} onChange={(event) => {
            const next = event.target.checked
            setPreorder(next)
            setResult(null)
            setProduct((current) => {
              const others = (current.tags ?? []).filter((tag) => tag !== PREORDER_TAG)
              return { ...current, tags: next ? [...others, PREORDER_TAG] : others }
            })
          }} /><span><strong>預購商品</strong><small>庫存不需管理，前台顯示「約 14–21 天出貨」並可直接下單</small></span></label>
          <p className="admin-draft-note">{requireImage ? '商品資料、規格與主圖會一次建立。建立後先保留為草稿，確認內容無誤再上架。' : '儲存修改不會自動變更目前的上架狀態。'}</p>
        </aside>
      </div>
      <div className="admin-product-savebar">
        <div>{result?.message ? <p className="admin-save-error" role="alert">{result.message}</p> : null}</div>
        <div className="admin-savebar-actions">
          {requireImage && saveDraft ? (
            <button type="button" className="button button-secondary" disabled={pending} onClick={handleSaveDraft}>儲存草稿</button>
          ) : null}
          <button aria-label={requireImage ? '儲存並建立商品' : '儲存商品'} className="button" type="submit" disabled={pending || compressing}>{pending ? '儲存中…' : compressing ? '圖片處理中…' : requireImage ? '儲存並建立商品' : '儲存商品'}</button>
        </div>
      </div>
      <ConfirmModal
        open={pendingSave !== null}
        title={requireImage ? '確定要建立這件商品嗎？' : '確定要儲存修改嗎？'}
        message={requireImage ? '建立後會回到商品列表，先保留為草稿，可再上架。' : '將更新這件商品的內容。'}
        confirmLabel={requireImage ? '確定建立' : '確定儲存'}
        pending={pending}
        onConfirm={runSave}
        onCancel={() => setPendingSave(null)}
      />
    </form>
  )
}
