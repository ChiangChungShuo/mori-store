'use client'

import { useEffect, useState } from 'react'

export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 360)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      className="back-to-top"
      data-visible={visible}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      aria-label="回到頁面上方"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 14 6-6 6 6" /></svg>
      <span className="back-to-top-label">TOP</span>
    </button>
  )
}
