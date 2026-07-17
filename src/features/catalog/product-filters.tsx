import Link from 'next/link'
import type { ProductFilters as ProductFilterValues } from '@/features/catalog/queries'

const ages: Array<NonNullable<ProductFilterValues['age']>> = ['0-2', '3-5', '6-9', '10-12']

export function ProductFilters({ filters }: { filters: ProductFilterValues }) {
  return (
    <form action="/products" method="get" aria-label="篩選商品" className="product-filters">
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
        <input name="category" defaultValue={filters.category ?? ''} />
      </label>

      <label className="checkbox-label">
        <input name="inStock" type="checkbox" value="true" defaultChecked={filters.inStock} />
        只顯示有庫存
      </label>

      <div className="filter-actions">
        <button type="submit" className="button">套用篩選</button>
        <Link href="/products">清除</Link>
      </div>
    </form>
  )
}
