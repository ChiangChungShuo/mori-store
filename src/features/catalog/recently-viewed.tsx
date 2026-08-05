'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useSyncExternalStore } from 'react'
import { formatTwd } from '@/lib/money'

/**
 * Recently viewed products, kept in the browser.
 *
 * Shoppers compare several pieces before buying one, and without this they have
 * to find the earlier ones again. Everything needed to render a row is stored
 * locally, so the strip costs no extra server work.
 */
const STORAGE_KEY = 'mori-recently-viewed'
const MAX_ITEMS = 8

export type RecentProduct = {
  slug: string
  name: string
  price: number
  imageUrl: string | null
  imageAlt: string
}

function read(): RecentProduct[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is RecentProduct => (
      Boolean(item)
      && typeof (item as RecentProduct).slug === 'string'
      && typeof (item as RecentProduct).name === 'string'
      && typeof (item as RecentProduct).price === 'number'
    )).slice(0, MAX_ITEMS)
  } catch {
    return []
  }
}

function write(items: RecentProduct[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
    window.dispatchEvent(new Event(CHANGED_EVENT))
  } catch {
    // Private mode: browsing must keep working without the history.
  }
}

const CHANGED_EVENT = 'mori:recently-viewed'
const EMPTY: RecentProduct[] = []

// useSyncExternalStore needs a referentially stable snapshot, so the parsed list
// is cached and only rebuilt when the stored string actually changes.
let cachedRaw: string | null = null
let cachedItems: RecentProduct[] = EMPTY

function getSnapshot(): RecentProduct[] {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedItems = read()
  }
  return cachedItems
}

function getServerSnapshot(): RecentProduct[] {
  return EMPTY
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** Records a visit. Rendered on the product page. */
export function RecentlyViewedTracker({ product }: { product: RecentProduct }) {
  useEffect(() => {
    const next = [product, ...read().filter((item) => item.slug !== product.slug)]
    write(next)
  }, [product])

  return null
}

export function RecentlyViewed({ excludeSlug, title = '最近看過' }: {
  excludeSlug?: string
  title?: string
}) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const items = stored.filter((item) => item.slug !== excludeSlug)

  if (items.length === 0) return null

  return (
    <section aria-labelledby="recently-viewed-title" className="recently-viewed">
      <div className="recently-viewed-head">
        <h2 id="recently-viewed-title">{title}</h2>
        <button onClick={() => write([])} type="button">清除紀錄</button>
      </div>
      <div className="recently-viewed-row">
        {items.map((item) => (
          <Link className="recently-viewed-card" href={`/products/${item.slug}`} key={item.slug}>
            <span className="recently-viewed-image">
              {item.imageUrl ? (
                <Image alt={item.imageAlt} fill sizes="9rem" src={item.imageUrl} />
              ) : <em>mori</em>}
            </span>
            <strong>{item.name}</strong>
            <small>{formatTwd(item.price)}</small>
          </Link>
        ))}
      </div>
    </section>
  )
}
