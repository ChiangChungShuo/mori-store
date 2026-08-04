'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { FilterClearLink } from '@/components/filter-clear-link'
import { type ProductFilters as ProductFilterValues } from '@/features/catalog/queries'
import { AGE_BANDS, ageBandLabel, ageBandRange } from '@/lib/age-bands'

// Builds a /products URL from the applied filters minus one of them, so the
// active-filter chips can each be removed with a single tap.
function hrefWithout(filters: ProductFilterValues, drop: 'q' | 'age' | 'size' | 'color' | 'inStock') {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.category && filters.series) params.set('series', filters.series)
  if (filters.view) params.set('view', filters.view)
  if (filters.q && drop !== 'q') params.set('q', filters.q)
  if (filters.age && drop !== 'age') params.set('age', filters.age)
  if (filters.size && drop !== 'size') params.set('size', filters.size)
  if (filters.color && drop !== 'color') params.set('color', filters.color)
  if (filters.inStock && drop !== 'inStock') params.set('inStock', 'true')
  const query = params.toString()
  return query ? `/products?${query}` : '/products'
}

// Filter toolbar. Desktop lays every control out in one row; on phones the
// detail controls collapse into a bottom sheet behind a 篩選 button, because a
// six-row stacked form pushed the products themselves below the fold.
export function ProductFilters({ filters, sizeOptions = [], colorOptions = [] }: {
  filters: ProductFilterValues
  sizeOptions?: string[]
  colorOptions?: string[]
}) {
  const [sheetOpen, setSheetOpen] = useState(false)

  // Keep a value that came from the URL selectable even if it is no longer sold.
  const sizes = filters.size && !sizeOptions.includes(filters.size)
    ? [...sizeOptions, filters.size]
    : sizeOptions
  const colors = filters.color && !colorOptions.includes(filters.color)
    ? [...colorOptions, filters.color]
    : colorOptions
  const clearHref = filters.category
    ? `/products?category=${encodeURIComponent(filters.category)}${filters.view ? `&view=${filters.view}` : ''}`
    : filters.view ? `/products?view=${filters.view}` : '/products'

  const activeChips = [
    filters.q ? { key: 'q' as const, label: `「${filters.q}」` } : null,
    filters.age ? { key: 'age' as const, label: `${ageBandLabel(filters.age)}／${ageBandRange(filters.age)}` } : null,
    filters.size ? { key: 'size' as const, label: `尺寸 ${filters.size}` } : null,
    filters.color ? { key: 'color' as const, label: filters.color } : null,
    filters.inStock ? { key: 'inStock' as const, label: '只看有庫存' } : null,
  ].filter((chip): chip is { key: 'q' | 'age' | 'size' | 'color' | 'inStock'; label: string } => chip !== null)

  // A sheet that scrolls the page behind it feels broken on iOS.
  useEffect(() => {
    if (!sheetOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSheetOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [sheetOpen])

  return (
    <>
      <form action="/products" method="get" aria-label="篩選商品" className="product-filterbar" data-sheet-open={sheetOpen}>
        {filters.category ? <input name="category" type="hidden" value={filters.category} /> : null}
        {filters.category && filters.series ? <input name="series" type="hidden" value={filters.series} /> : null}
        {filters.view ? <input name="view" type="hidden" value={filters.view} /> : null}

        <div className="product-filterbar-lead">
          <input
            aria-label="搜尋商品"
            className="product-filterbar-search"
            defaultValue={filters.q ?? ''}
            name="q"
            placeholder="搜尋商品名稱"
            type="search"
          />
          <button
            aria-expanded={sheetOpen}
            className="product-filterbar-toggle"
            onClick={() => setSheetOpen(true)}
            type="button"
          >
            <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 14" width="16">
              <path d="M1 3h14M3.5 7h9M6 11h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
            </svg>
            篩選{activeChips.length ? <span>{activeChips.length}</span> : null}
          </button>
        </div>

        <div className="product-filterbar-sheet" role="group" aria-label="篩選條件">
          <div className="product-filterbar-sheet-head">
            <strong>篩選條件</strong>
            <button aria-label="關閉篩選" onClick={() => setSheetOpen(false)} type="button">✕</button>
          </div>

          <label className="product-filterbar-field">
            <span>年齡</span>
            <select aria-label="年齡" defaultValue={filters.age ?? ''} name="age">
              <option value="">全部年齡</option>
              {AGE_BANDS.map((band) => <option value={band.value} key={band.value}>{band.label}｜{band.range}</option>)}
            </select>
          </label>

          <label className="product-filterbar-field">
            <span>尺寸</span>
            {sizes.length > 0 ? (
              <select aria-label="尺寸" defaultValue={filters.size ?? ''} name="size">
                <option value="">全部尺寸</option>
                {sizes.map((size) => <option value={size} key={size}>{size}</option>)}
              </select>
            ) : (
              <input aria-label="尺寸" defaultValue={filters.size ?? ''} inputMode="numeric" name="size" placeholder="尺寸" />
            )}
          </label>

          <label className="product-filterbar-field">
            <span>顏色</span>
            {colors.length > 0 ? (
              <select aria-label="顏色" defaultValue={filters.color ?? ''} name="color">
                <option value="">全部顏色</option>
                {colors.map((color) => <option value={color} key={color}>{color}</option>)}
              </select>
            ) : (
              <input aria-label="顏色" defaultValue={filters.color ?? ''} name="color" placeholder="顏色" />
            )}
          </label>

          <label className="product-filterbar-stock">
            <input defaultChecked={filters.inStock} name="inStock" type="checkbox" value="true" />
            <span>只顯示有庫存</span>
          </label>

          <div className="filter-actions">
            <button type="submit" className="button">套用篩選</button>
            <FilterClearLink href={clearHref} />
          </div>
        </div>
      </form>

      {activeChips.length ? (
        <div className="product-filterbar-active">
          <span>已套用</span>
          {activeChips.map((chip) => (
            <Link href={hrefWithout(filters, chip.key)} key={chip.key}>
              {chip.label}<span aria-hidden="true">✕</span>
            </Link>
          ))}
          <Link className="product-filterbar-active-clear" href={clearHref}>全部清除</Link>
        </div>
      ) : null}

      {sheetOpen ? <div className="product-filterbar-scrim" onClick={() => setSheetOpen(false)} role="presentation" /> : null}
    </>
  )
}
