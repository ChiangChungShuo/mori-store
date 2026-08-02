'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useProductColor } from '@/features/catalog/product-color-context'
import { imagesForColor, type CatalogProductImage } from '@/features/catalog/product-images'

export function ProductGallery({ images, isNew }: {
  images: readonly CatalogProductImage[]
  isNew: boolean
}) {
  const { color } = useProductColor()
  const [selection, setSelection] = useState({ color, index: 0 })
  const [zoomed, setZoomed] = useState(false)
  const touchStart = useRef<number | null>(null)
  const visibleImages = imagesForColor(images, color)
  const active = selection.color === color && selection.index < visibleImages.length
    ? selection.index
    : 0
  const image = visibleImages[active] ?? visibleImages[0]

  function show(offset: number) {
    setSelection({
      color,
      index: (active + offset + visibleImages.length) % visibleImages.length,
    })
  }

  useEffect(() => {
    if (!zoomed) return
    function close(event: KeyboardEvent) {
      if (event.key === 'Escape') setZoomed(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [zoomed])

  return (
    <div className="product-gallery" data-multiple={visibleImages.length > 1}>
      <div className="product-gallery-main" onTouchStart={(event) => { touchStart.current = event.changedTouches[0]?.clientX ?? null }} onTouchEnd={(event) => {
        if (touchStart.current === null || visibleImages.length < 2) return
        const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current
        if (Math.abs(distance) > 45) show(distance > 0 ? -1 : 1)
        touchStart.current = null
      }}>
        {image ? (
          <Image
            alt={image.alt}
            className="product-image"
            fill
            key={image.url}
            priority={active === 0}
            sizes="(max-width: 58rem) 100vw, 34rem"
            src={image.url}
          />
        ) : <span className="product-image-placeholder" aria-hidden="true">mori</span>}
        <div className="product-image-badges">{isNew && <span>NEW</span>}<span>0–12 KIDS</span></div>
        {image ? <button className="product-gallery-zoom" type="button" onClick={() => setZoomed(true)}>放大圖片</button> : null}
        {visibleImages.length > 1 ? <>
          <button aria-label="上一張商品圖片" className="product-gallery-arrow product-gallery-prev" type="button" onClick={() => show(-1)}>
            <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 9 14" width="9"><path d="M7.5 1 1.5 7l6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" /></svg>
          </button>
          <button aria-label="下一張商品圖片" className="product-gallery-arrow product-gallery-next" type="button" onClick={() => show(1)}>
            <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 9 14" width="9"><path d="M1.5 1l6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" /></svg>
          </button>
        </> : null}
        {visibleImages.length > 1 ? <div className="product-gallery-position">{active + 1} / {visibleImages.length}</div> : null}
      </div>
      {visibleImages.length > 1 ? <div className="product-gallery-thumbnails" aria-label="商品圖片">{visibleImages.map((candidate, index) => <button aria-label={`查看第 ${index + 1} 張商品圖片`} aria-pressed={active === index} key={`${candidate.url}-${index}`} onClick={() => setSelection({ color, index })} type="button">
        <Image alt="" fill sizes="5rem" src={candidate.url} />
      </button>)}</div> : null}
      {/* Portalled to <body>: the sticky gallery column forms a stacking
          context, which would trap the fixed lightbox under the site header. */}
      {zoomed && image ? createPortal(
        <div aria-label="商品圖片放大檢視" aria-modal="true" className="product-gallery-lightbox" role="dialog" onClick={() => setZoomed(false)}>
          <button aria-label="關閉放大圖片" type="button" onClick={() => setZoomed(false)}>×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={image.alt} src={image.url} onClick={(event) => event.stopPropagation()} />
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
