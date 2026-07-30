'use client'

import { useRef, useState } from 'react'
import { HeroCarousel } from '@/features/storefront/hero-carousel'
import type { BannerSlide } from '@/features/storefront/banner-settings'

const MAX_SLIDES = 5

const emptySlide: BannerSlide = {
  imageUrl: '', imageAlt: '', eyebrow: '', title: '', body: '', buttonLabel: '', buttonHref: '',
}

type DraftRow = { key: number; slide: BannerSlide }

export function BannerSettingsEditor({
  slides,
  action,
}: {
  slides: BannerSlide[]
  action: (formData: FormData) => Promise<void>
}) {
  const keyRef = useRef(0)
  const [drafts, setDrafts] = useState<DraftRow[]>(() =>
    (slides.length ? slides : [emptySlide]).map((slide) => ({ key: keyRef.current++, slide: { ...slide } })),
  )

  function update(index: number, field: keyof BannerSlide, value: string) {
    setDrafts((current) => current.map((row, rowIndex) =>
      rowIndex === index ? { ...row, slide: { ...row.slide, [field]: value } } : row))
  }

  function addSlide() {
    setDrafts((current) => current.length >= MAX_SLIDES
      ? current
      : [...current, { key: keyRef.current++, slide: { ...emptySlide } }])
  }

  function removeSlide(index: number) {
    setDrafts((current) => current.length <= 1 ? current : current.filter((_, rowIndex) => rowIndex !== index))
  }

  const previewSlides = drafts
    .map((row) => row.slide)
    .filter((slide) => slide.imageUrl || slide.title)
    .map((slide) => ({
      imageUrl: slide.imageUrl || '/images/mori-hero.jpg',
      imageAlt: slide.imageAlt || '首頁輪播預覽',
      eyebrow: slide.eyebrow || 'mori seasonal edit',
      title: slide.title || '在這裡預覽主標題',
      body: slide.body || '輸入說明文字後，會直接呈現前台排版。',
      buttonLabel: slide.buttonLabel || '查看商品',
      buttonHref: slide.buttonHref || '/products',
    }))

  return (
    <form action={action} className="admin-stack-form" encType="multipart/form-data">
      <input name="slideCount" type="hidden" value={drafts.length} />
      <div className="admin-live-preview" aria-label="首頁輪播即時預覽">
        <div className="admin-live-preview-heading"><div><strong>前台即時預覽</strong><span>輸入文字或選擇圖片後立即更新</span></div><a href="/" target="_blank">另開首頁 ↗</a></div>
        <HeroCarousel slides={previewSlides.length ? previewSlides : [{ ...emptySlide, imageUrl: '/images/mori-hero.jpg', imageAlt: '首頁輪播預覽', eyebrow: 'mori seasonal edit', title: '首頁主視覺', body: '從下方開始編輯輪播內容。', buttonLabel: '查看商品', buttonHref: '/products' }]} />
      </div>
      <div className="admin-banner-grid">
        {drafts.map((row, index) => (
          <fieldset key={row.key}>
            <legend>
              <span>{String(index + 1).padStart(2, '0')} 輪播內容</span>
              {drafts.length > 1 ? <button type="button" className="admin-banner-remove" onClick={() => removeSlide(index)}>刪除這張</button> : null}
            </legend>
            <input name={`imageUrl-${index}`} type="hidden" value={row.slide.imageUrl} />
            {row.slide.imageUrl ? <div className="admin-banner-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={row.slide.imageAlt || '輪播預覽'} src={row.slide.imageUrl} />
            </div> : <div className="admin-banner-placeholder">等待上傳圖片</div>}
            <label>更換圖片<input accept="image/jpeg,image/png,image/webp" name={`image-${index}`} type="file" onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) update(index, 'imageUrl', URL.createObjectURL(file))
            }} /></label>
            <label>圖片說明<input name={`imageAlt-${index}`} value={row.slide.imageAlt} onChange={(event) => update(index, 'imageAlt', event.target.value)} placeholder="描述圖片中的人物與情境" /></label>
            <label>英文小標<input name={`eyebrow-${index}`} value={row.slide.eyebrow} onChange={(event) => update(index, 'eyebrow', event.target.value)} placeholder="mori seasonal edit" /></label>
            <label>主標題<textarea name={`title-${index}`} value={row.slide.title} onChange={(event) => update(index, 'title', event.target.value)} placeholder={'小小日常，\n自在長大。'} rows={3} /></label>
            <label>說明文字<textarea name={`body-${index}`} value={row.slide.body} onChange={(event) => update(index, 'body', event.target.value)} rows={3} /></label>
            <div className="admin-banner-link-fields"><label>按鈕文字<input name={`buttonLabel-${index}`} value={row.slide.buttonLabel} onChange={(event) => update(index, 'buttonLabel', event.target.value)} /></label><label>站內連結<input name={`buttonHref-${index}`} value={row.slide.buttonHref} onChange={(event) => update(index, 'buttonHref', event.target.value)} placeholder="/products" /></label></div>
          </fieldset>
        ))}
      </div>
      {drafts.length < MAX_SLIDES
        ? <button type="button" className="button button-secondary admin-banner-add" onClick={addSlide}>＋ 新增一張輪播（最多 {MAX_SLIDES} 張）</button>
        : <p className="admin-field-hint">已達最多 {MAX_SLIDES} 張輪播。</p>}
      <p className="admin-field-hint">首頁需要 2 張以上才會自動輪播；只有 1 張時會顯示為固定主視覺。</p>
      <button className="button" type="submit">儲存首頁輪播</button>
    </form>
  )
}
