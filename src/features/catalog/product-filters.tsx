'use client'

import Link from 'next/link'
import { useState } from 'react'
import { type ProductFilters as ProductFilterValues } from '@/features/catalog/queries'
import { defaultProductCategories } from '@/features/catalog/category-defaults'
import { AGE_BANDS } from '@/lib/age-bands'

export function ProductFilters({ filters, categories = [...defaultProductCategories] }: { filters: ProductFilterValues; categories?: string[] }) {
  const [category, setCategory] = useState(filters.category ?? '')
  return (
    <form action="/products" method="get" aria-label="篩選商品" className="product-filters">
      {filters.series && category === filters.category ? <input name="series" type="hidden" value={filters.series} /> : null}
      <label className="product-search-field">
        搜尋商品
        <input name="q" defaultValue={filters.q ?? ''} placeholder="輸入商品名稱" type="search" />
      </label>
      <label>
        年齡
        <select name="age" defaultValue={filters.age ?? ''}>
          <option value="">全部年齡</option>
          {AGE_BANDS.map((band) => <option value={band.value} key={band.value}>{band.label}｜{band.range}</option>)}
        </select>
      </label>

      <label>
        尺寸
        <input name="size" defaultValue={filters.size ?? ''} inputMode="numeric" placeholder="例：100" />
      </label>

      <label>
        顏色
        <input name="color" defaultValue={filters.color ?? ''} placeholder="例：白色" />
      </label>

      <label>
        分類
        <select name="category" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">全部分類</option>
          {categories.map((category) => <option value={category} key={category}>{category}</option>)}
        </select>
      </label>

      <label className="checkbox-label">
        <input name="inStock" type="checkbox" value="true" defaultChecked={filters.inStock} />
        只顯示有庫存
      </label>

      <div className="filter-actions">
        <button type="submit" className="button">套用篩選</button>
        <Link className="filter-clear-button" href="/products"><span aria-hidden="true">↺</span> 清除條件</Link>
      </div>
    </form>
  )
}
