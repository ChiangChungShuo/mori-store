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
      <svg aria-hidden="true" data-filled={count > 0} viewBox="0 0 24 24">
        <path d="M12 20.2S4 15.5 4 9.5C4 6.7 5.8 5 8.2 5c1.7 0 3.1 1 3.8 2.2C12.7 6 14.1 5 15.8 5 18.2 5 20 6.7 20 9.5c0 6-8 10.7-8 10.7Z" />
      </svg>
      <span className="wishlist-header-count">{count}</span>
    </Link>
  )
}
