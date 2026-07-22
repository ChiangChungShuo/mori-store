'use client'

import { useEffect, useState } from 'react'

const storageKey = 'mori-wishlist'
const changedEvent = 'mori:wishlist-changed'

function readWishlist() {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function readWishlistIds() {
  return readWishlist()
}

export function WishlistButton({ productId, productName, compact = false }: {
  productId: string
  productName: string
  compact?: boolean
}) {
  const [saved, setSaved] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const sync = () => setSaved(readWishlist().includes(productId))
    sync()
    window.addEventListener(changedEvent, sync)
    return () => window.removeEventListener(changedEvent, sync)
  }, [productId])

  function toggle() {
    const ids = readWishlist()
    const next = ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId]
    window.localStorage.setItem(storageKey, JSON.stringify(next))
    const nextSaved = next.includes(productId)
    setSaved(nextSaved)
    setNotice(nextSaved ? '已加入收藏' : '已從收藏移除')
    window.dispatchEvent(new Event(changedEvent))
    window.setTimeout(() => setNotice(''), 1800)
  }

  return <button aria-label={`${saved ? '移除' : '收藏'} ${productName}`} aria-pressed={saved} className={compact ? 'wishlist-button wishlist-button-compact' : 'wishlist-button'} onClick={toggle} type="button">
    <span aria-hidden="true">{saved ? '♥' : '♡'}</span>
    {!compact && (saved ? '已加入追蹤清單' : '加入追蹤清單')}
    {notice ? <span className="wishlist-toast" role="status">{notice}</span> : null}
  </button>
}
