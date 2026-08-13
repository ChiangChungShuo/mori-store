'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FilterClearLink } from '@/components/filter-clear-link'
import { priceBands, productSortOptions } from '@/features/catalog/catalog-sort'
import { type ProductFilters as ProductFilterValues } from '@/features/catalog/queries'
import { AGE_BANDS, ageBandLabel, ageBandRange } from '@/lib/age-bands'
import type { ProductSeries } from '@/features/catalog/product-series'

// Builds a /products URL from the applied filters minus one of them, so the
// active-filter chips can each be removed with a single tap.
function hrefWithout(filters: ProductFilterValues, drop: 'q' | 'age' | 'size' | 'color' | 'inStock' | 'price' | 'series' | 'view') {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.series && drop !== 'series') params.set('series', filters.series)
  if (filters.view && drop !== 'view') params.set('view', filters.view)
  if (filters.q && drop !== 'q') params.set('q', filters.q)
  if (filters.age && drop !== 'age') params.set('age', filters.age)
  if (filters.size && drop !== 'size') params.set('size', filters.size)
  if (filters.color && drop !== 'color') params.set('color', filters.color)
  if (filters.inStock && drop !== 'inStock') params.set('inStock', 'true')
  if (filters.price && drop !== 'price') params.set('price', filters.price)
  if (filters.sort) params.set('sort', filters.sort)
  const query = params.toString()
  return query ? `/products?${query}` : '/products'
}

// Filter toolbar. Desktop lays every control out in one row; on phones the
// detail controls collapse into a bottom sheet behind a 篩選 button, because a
// six-row stacked form pushed the products themselves below the fold.
export function ProductFilters({ filters, sizeOptions = [], colorOptions = [], seriesOptions = [] }: {
  filters: ProductFilterValues
  sizeOptions?: string[]
  colorOptions?: string[]
  seriesOptions?: ProductSeries[]
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const router = useRouter()

  // A plain GET form posts every empty field, so one tap on 排序 would leave
  // ?q=&age=&size=… in the address bar. Build the URL from the filled fields
  // instead and navigate to that.
  function submitFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    for (const [name, value] of new FormData(event.currentTarget)) {
      const text = String(value).trim()
      if (text && !(name === 'sort' && text === 'featured')) params.set(name, text)
    }
    setSheetOpen(false)
    const query = params.toString()
    router.push(query ? `/products?${query}` : '/products')
  }

  // Keep a value that came from the URL selectable even if it is no longer sold.
  const sizes = filters.size && !sizeOptions.includes(filters.size)
    ? [...sizeOptions, filters.size]
    : sizeOptions
  const colors = filters.color && !colorOptions.includes(filters.color)
    ? [...colorOptions, filters.color]
    : colorOptions
  const availableSeries = [...new Map(
    seriesOptions
      .filter((series) => !filters.category || series.categoryName === filters.category)
      .map((series) => [series.name, series]),
  ).values()]
  const clearHref = filters.category
    ? `/products?category=${encodeURIComponent(filters.category)}${filters.view ? `&view=${filters.view}` : ''}`
    : filters.view ? `/products?view=${filters.view}` : '/products'

  const activeChips = [
    filters.q ? { key: 'q' as const, label: `「${filters.q}」` } : null,
    filters.age ? { key: 'age' as const, label: `${ageBandLabel(filters.age)}／${ageBandRange(filters.age)}` } : null,
    filters.size ? { key: 'size' as const, label: `尺寸 ${filters.size}` } : null,
    filters.color ? { key: 'color' as const, label: filters.color } : null,
    filters.price ? { key: 'price' as const, label: priceBands[filters.price].label } : null,
    filters.inStock ? { key: 'inStock' as const, label: '只看有庫存' } : null,
    filters.series ? { key: 'series' as const, label: filters.series } : null,
    filters.view ? { key: 'view' as const, label: filters.view === 'ready' ? '現貨快速出貨' : filters.view === 'preorder' ? '預購新品' : filters.view === 'popular' ? '本週熱賣' : '依系列瀏覽' } : null,
  ].filter((chip): chip is { key: 'q' | 'age' | 'size' | 'color' | 'inStock' | 'price' | 'series' | 'view'; label: string } => chip !== null)

  useEffect(() => {
    if (!sheetOpen) return
    // A bottom sheet that scrolls the page behind it feels broken on iOS; the
    // desktop dropdown is anchored to the bar, so there the lock would only
    // make the page jump.
    const isSheet = window.matchMedia('(max-width: 58rem)').matches
    const previous = document.body.style.overflow
    if (isSheet) document.body.style.overflow = 'hidden'
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSheetOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      if (isSheet) document.body.style.overflow = previous
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [sheetOpen])

  return (
    <>
      <form action="/products" method="get" aria-label="篩選商品" className="product-filterbar" data-sheet-open={sheetOpen} onSubmit={submitFilters}>
        {filters.category ? <input name="category" type="hidden" value={filters.category} /> : null}

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

        <label className="product-filterbar-sort">
          <span>排序</span>
          <select
            aria-label="排序方式"
            defaultValue={filters.sort ?? 'featured'}
            name="sort"
            // Sorting is not a filter you "apply": pick it and the list reorders.
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            {productSortOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <div className="product-filterbar-sheet" role="group" aria-label="篩選條件">
          <div className="product-filterbar-sheet-head">
            <strong>篩選條件</strong>
            <button aria-label="關閉篩選" onClick={() => setSheetOpen(false)} type="button">✕</button>
          </div>

          <fieldset className="product-filter-group">
            <legend>商品狀態</legend>
            <div className="product-filter-chips">
              <label><input defaultChecked={!filters.view || filters.view === 'series'} name="view" type="radio" value="" /><span>全部商品</span></label>
              <label><input defaultChecked={filters.view === 'ready'} name="view" type="radio" value="ready" /><span>現貨快速出貨</span></label>
              <label><input defaultChecked={filters.view === 'preorder'} name="view" type="radio" value="preorder" /><span>預購新品</span></label>
              <label><input defaultChecked={filters.view === 'popular'} name="view" type="radio" value="popular" /><span>本週熱賣</span></label>
            </div>
          </fieldset>

          <fieldset className="product-filter-group">
            <legend>系列</legend>
            <div className="product-filter-chips product-filter-series-chips">
              <label><input defaultChecked={!filters.series} name="series" type="radio" value="" /><span>全部系列</span></label>
              {availableSeries.map((series) => (
                <label key={`${series.categoryName}-${series.name}`}>
                  <input defaultChecked={filters.series === series.name} name="series" type="radio" value={series.name} />
                  <span>{series.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Chips rather than dropdowns: one tap instead of open-scroll-pick,
              and the whole panel reads at a glance. */}
          <fieldset className="product-filter-group">
            <legend>年齡</legend>
            <div className="product-filter-chips">
              <label><input defaultChecked={!filters.age} name="age" type="radio" value="" /><span>全部</span></label>
              {AGE_BANDS.map((band) => (
                <label key={band.value}>
                  <input defaultChecked={filters.age === band.value} name="age" type="radio" value={band.value} />
                  <span>{band.label}<small>{band.range}</small></span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="product-filter-group">
            <legend>尺寸</legend>
            {sizes.length > 0 ? (
              <div className="product-filter-chips">
                <label><input defaultChecked={!filters.size} name="size" type="radio" value="" /><span>全部</span></label>
                {sizes.map((size) => (
                  <label key={size}>
                    <input defaultChecked={filters.size === size} name="size" type="radio" value={size} />
                    <span>{size}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input aria-label="尺寸" defaultValue={filters.size ?? ''} inputMode="numeric" name="size" placeholder="尺寸" />
            )}
          </fieldset>

          <fieldset className="product-filter-group">
            <legend>顏色</legend>
            {colors.length > 0 ? (
              <div className="product-filter-chips">
                <label><input defaultChecked={!filters.color} name="color" type="radio" value="" /><span>全部</span></label>
                {colors.map((color) => (
                  <label key={color}>
                    <input defaultChecked={filters.color === color} name="color" type="radio" value={color} />
                    <span>{color}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input aria-label="顏色" defaultValue={filters.color ?? ''} name="color" placeholder="顏色" />
            )}
          </fieldset>

          <fieldset className="product-filter-group">
            <legend>價格</legend>
            <div className="product-filter-chips">
              <label><input defaultChecked={!filters.price} name="price" type="radio" value="" /><span>全部</span></label>
              {Object.entries(priceBands).map(([value, band]) => (
                <label key={value}>
                  <input defaultChecked={filters.price === value} name="price" type="radio" value={value} />
                  <span>{band.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="product-filterbar-stock">
            <input defaultChecked={filters.inStock} name="inStock" type="checkbox" value="true" />
            <span>只看現在有庫存的商品</span>
          </label>

          <div className="filter-actions">
            <FilterClearLink href={clearHref} />
            <button type="submit" className="button">套用篩選</button>
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
