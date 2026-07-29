'use client'

import { useState } from 'react'
import { HeroCarousel } from '@/features/storefront/hero-carousel'
import type { BannerSlide } from '@/features/storefront/banner-settings'

type DraftSlide = BannerSlide

const emptySlide: DraftSlide = {
  imageUrl: '', imageAlt: '', eyebrow: '', title: '', body: '', buttonLabel: '', buttonHref: '',
}

export function BannerSettingsEditor({
  slides,
  slideSlots,
  action,
}: {
  slides: BannerSlide[]
  slideSlots: number
  action: (formData: FormData) => Promise<void>
}) {
  const [drafts, setDrafts] = useState<DraftSlide[]>(() => Array.from(
    { length: slideSlots },
    (_, index) => ({ ...(slides[index] ?? emptySlide) }),
  ))

  function update(index: number, field: keyof DraftSlide, value: string) {
    setDrafts((current) => current.map((slide, slideIndex) => slideIndex === index ? { ...slide, [field]: value } : slide))
  }

  const previewSlides = drafts
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
      <input name="slideCount" type="hidden" value={slideSlots} />
      <div className="admin-live-preview" aria-label="首頁輪播即時預覽">
        <div className="admin-live-preview-heading"><div><strong>前台即時預覽</strong><span>輸入文字或選擇圖片後立即更新</span></div><a href="/" target="_blank">另開首頁 ↗</a></div>
        <HeroCarousel slides={previewSlides.length ? previewSlides : [{ ...emptySlide, imageUrl: '/images/mori-hero.jpg', imageAlt: '首頁輪播預覽', eyebrow: 'mori seasonal edit', title: '首頁主視覺', body: '從下方開始編輯輪播內容。', buttonLabel: '查看商品', buttonHref: '/products' }]} />
      </div>
      <div className="admin-banner-grid">
        {drafts.map((slide, index) => (
          <fieldset key={index}>
            <legend>{String(index + 1).padStart(2, '0')} {slides[index] ? '輪播內容' : '新增輪播'}</legend>
            <input name={`imageUrl-${index}`} type="hidden" value={slides[index]?.imageUrl ?? ''} />
            {slide.imageUrl ? <div className="admin-banner-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={slide.imageAlt || '輪播預覽'} src={slide.imageUrl} />
            </div> : <div className="admin-banner-placeholder">等待上傳圖片</div>}
            <label>更換圖片<input accept="image/jpeg,image/png,image/webp" name={`image-${index}`} type="file" onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) update(index, 'imageUrl', URL.createObjectURL(file))
            }} /></label>
            <label>圖片說明<input name={`imageAlt-${index}`} value={slide.imageAlt} onChange={(event) => update(index, 'imageAlt', event.target.value)} placeholder="描述圖片中的人物與情境" /></label>
            <label>英文小標<input name={`eyebrow-${index}`} value={slide.eyebrow} onChange={(event) => update(index, 'eyebrow', event.target.value)} placeholder="mori seasonal edit" /></label>
            <label>主標題<textarea name={`title-${index}`} value={slide.title} onChange={(event) => update(index, 'title', event.target.value)} placeholder={'小小日常，\n自在長大。'} rows={3} /></label>
            <label>說明文字<textarea name={`body-${index}`} value={slide.body} onChange={(event) => update(index, 'body', event.target.value)} rows={3} /></label>
            <div className="admin-banner-link-fields"><label>按鈕文字<input name={`buttonLabel-${index}`} value={slide.buttonLabel} onChange={(event) => update(index, 'buttonLabel', event.target.value)} /></label><label>站內連結<input name={`buttonHref-${index}`} value={slide.buttonHref} onChange={(event) => update(index, 'buttonHref', event.target.value)} placeholder="/products" /></label></div>
          </fieldset>
        ))}
      </div>
      <button className="button" type="submit">儲存首頁輪播</button>
    </form>
  )
}
