'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { readWishlistIds } from './wishlist-button'

export function WishlistHeaderLink() {
  const [count, setCount] = useState(0)
  const [bumping, setBumping] = useState(false)
  const previousCount = useRef(0)

  useEffect(() => {
    function sync() {
      const nextCount = readWishlistIds().length
      if (nextCount > previousCount.current) {
        setBumping(false)
        window.requestAnimationFrame(() => setBumping(true))
      }
      previousCount.current = nextCount
      setCount(nextCount)
    }

    sync()
    window.addEventListener('mori:wishlist-changed', sync)
    return () => window.removeEventListener('mori:wishlist-changed', sync)
  }, [])

  return (
    <Link className="wishlist-header-link" data-bumping={bumping} data-has-items={count > 0} href="/wishlist" onAnimationEnd={() => setBumping(false)}>
      <span aria-hidden="true">{count > 0 ? '♥' : '♡'}</span><span className="wishlist-header-count">{count}</span>
    </Link>
  )
}
