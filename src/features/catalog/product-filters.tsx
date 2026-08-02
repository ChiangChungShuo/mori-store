'use client'

import { FilterClearLink } from '@/components/filter-clear-link'
import { type ProductFilters as ProductFilterValues } from '@/features/catalog/queries'
import { AGE_BANDS } from '@/lib/age-bands'

// Single-row filter toolbar. 分類 lives in the pill nav above the toolbar, so
// the current category (and series) ride along as hidden inputs instead of a
// second, redundant control.
export function ProductFilters({ filters, sizeOptions = [], colorOptions = [] }: {
  filters: ProductFilterValues
  sizeOptions?: string[]
  colorOptions?: string[]
}) {
  // Keep a value that came from the URL selectable even if it is no longer sold.
  const sizes = filters.size && !sizeOptions.includes(filters.size)
    ? [...sizeOptions, filters.size]
    : sizeOptions
  const colors = filters.color && !colorOptions.includes(filters.color)
    ? [...colorOptions, filters.color]
    : colorOptions
  const clearHref = filters.category
    ? `/products?category=${encodeURIComponent(filters.category)}`
    : '/products'

  return (
    <form action="/products" method="get" aria-label="篩選商品" className="product-filterbar">
      {filters.category ? <input name="category" type="hidden" value={filters.category} /> : null}
      {filters.category && filters.series ? <input name="series" type="hidden" value={filters.series} /> : null}

      <input
        aria-label="搜尋商品"
        className="product-filterbar-search"
        defaultValue={filters.q ?? ''}
        name="q"
        placeholder="搜尋商品名稱"
        type="search"
      />

      <select aria-label="年齡" defaultValue={filters.age ?? ''} name="age">
        <option value="">全部年齡</option>
        {AGE_BANDS.map((band) => <option value={band.value} key={band.value}>{band.label}｜{band.range}</option>)}
      </select>

      {sizes.length > 0 ? (
        <select aria-label="尺寸" defaultValue={filters.size ?? ''} name="size">
          <option value="">全部尺寸</option>
          {sizes.map((size) => <option value={size} key={size}>{size}</option>)}
        </select>
      ) : (
        <input aria-label="尺寸" defaultValue={filters.size ?? ''} inputMode="numeric" name="size" placeholder="尺寸" />
      )}

      {colors.length > 0 ? (
        <select aria-label="顏色" defaultValue={filters.color ?? ''} name="color">
          <option value="">全部顏色</option>
          {colors.map((color) => <option value={color} key={color}>{color}</option>)}
        </select>
      ) : (
        <input aria-label="顏色" defaultValue={filters.color ?? ''} name="color" placeholder="顏色" />
      )}

      <label className="product-filterbar-stock">
        <input defaultChecked={filters.inStock} name="inStock" type="checkbox" value="true" />
        <span>只顯示有庫存</span>
      </label>

      <div className="filter-actions">
        <button type="submit" className="button">套用篩選</button>
        <FilterClearLink href={clearHref} />
      </div>
    </form>
  )
}
