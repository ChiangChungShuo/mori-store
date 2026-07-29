import Link from 'next/link'
import { type ProductFilters as ProductFilterValues } from '@/features/catalog/queries'
import { defaultProductCategories } from '@/features/catalog/category-defaults'

const ages: Array<NonNullable<ProductFilterValues['age']>> = ['0-2', '3-5', '6-9', '10-12']

export function ProductFilters({ filters, categories = [...defaultProductCategories] }: { filters: ProductFilterValues; categories?: string[] }) {
  return (
    <form action="/products" method="get" aria-label="篩選商品" className="product-filters">
      <label className="product-search-field">
        搜尋商品
        <input name="q" defaultValue={filters.q ?? ''} placeholder="輸入商品名稱" type="search" />
      </label>
      <label>
        年齡
        <select name="age" defaultValue={filters.age ?? ''}>
          <option value="">全部年齡</option>
          {ages.map((age) => <option value={age} key={age}>{age} 歲</option>)}
        </select>
      </label>

      <label>
        尺寸
        <input name="size" defaultValue={filters.size ?? ''} inputMode="numeric" />
      </label>

      <label>
        顏色
        <input name="color" defaultValue={filters.color ?? ''} />
      </label>

      <label>
        分類
        <select name="category" defaultValue={filters.category ?? ''}>
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
