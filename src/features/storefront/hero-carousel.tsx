'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { BannerSlide } from './banner-settings'

export function HeroCarousel({ slides }: { slides: BannerSlide[] }) {
  const [active, setActive] = useState(0)
  const pointerStart = useRef<number | null>(null)

  function showPrevious() {
    setActive((current) => (current - 1 + slides.length) % slides.length)
  }

  function showNext() {
    setActive((current) => (current + 1) % slides.length)
  }

  useEffect(() => {
    if (slides.length < 2) return
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 6500)
    return () => window.clearInterval(timer)
  }, [slides.length])

  const slide = slides[active] ?? slides[0]
  if (!slide) return null

  return (
    <section
      className="hero hero-carousel"
      aria-roledescription="輪播"
      aria-label="首頁主視覺"
      onPointerDown={(event) => { pointerStart.current = event.clientX }}
      onPointerUp={(event) => {
        if (pointerStart.current === null) return
        const distance = event.clientX - pointerStart.current
        pointerStart.current = null
        if (Math.abs(distance) < 48) return
        if (distance > 0) showPrevious()
        else showNext()
      }}
      onPointerCancel={() => { pointerStart.current = null }}
    >
      <div className="hero-copy" key={`${active}-copy`}>
        <p className="eyebrow">{slide.eyebrow}</p>
        <h1 id="hero-title">{slide.title.split('\n').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h1>
        <p>{slide.body}</p>
        <div className="hero-actions"><Link href={slide.buttonHref} className="button">{slide.buttonLabel}</Link><Link href="/products" className="text-link">瀏覽所有商品 →</Link></div>
      </div>
      <div className="hero-carousel-image" key={`${active}-image`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={slide.imageAlt} src={slide.imageUrl} />
      </div>
      {slides.length > 1 ? <><button className="hero-carousel-arrow hero-carousel-arrow-previous" type="button" aria-label="上一張輪播圖片" onClick={showPrevious}>←</button><button className="hero-carousel-arrow hero-carousel-arrow-next" type="button" aria-label="下一張輪播圖片" onClick={showNext}>→</button></> : null}
      {slides.length > 1 ? <div className="hero-carousel-controls" aria-label="選擇輪播圖片">{slides.map((candidate, index) => <button aria-label={`顯示第 ${index + 1} 張：${candidate.title.replaceAll('\n', '')}`} aria-pressed={index === active} key={`${candidate.imageUrl}-${index}`} onClick={() => setActive(index)} type="button">{String(index + 1).padStart(2, '0')}</button>)}</div> : null}
    </section>
  )
}
