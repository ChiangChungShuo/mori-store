'use client'

import { useActionState, useState } from 'react'
import { useActionToast } from '@/components/toast'
import type { ProductSeries, SeriesActionState } from '@/features/catalog/product-series'

type SeriesAction = (state: SeriesActionState, formData: FormData) => Promise<SeriesActionState>

export function SeriesManager({
  categories,
  series,
  createSeries,
  moveSeries,
  deleteSeries,
}: {
  categories: string[]
  series: ProductSeries[]
  createSeries: SeriesAction
  moveSeries: SeriesAction
  deleteSeries: SeriesAction
}) {
  const [selectedCategory, setSelectedCategory] = useState(categories[0] ?? '')
  const [createState, createAction, createPending] = useActionState(createSeries, { ok: false, message: '' })
  const [moveState, moveAction, movePending] = useActionState(moveSeries, { ok: false, message: '' })
  const [deleteState, deleteAction, deletePending] = useActionState(deleteSeries, { ok: false, message: '' })
  useActionToast(createState)
  useActionToast(moveState)
  useActionToast(deleteState)

  const visibleSeries = series
    .filter((item) => item.categoryName === selectedCategory)
    .sort((first, second) => first.position - second.position)

  return (
    <section className="admin-panel admin-series-manager">
      <header>
        <div><p className="eyebrow">catalog series</p><h2>系列管理</h2></div>
        <p>先選分類，再建立該分類專屬的系列與前台顯示順序。</p>
      </header>
      <div className="admin-series-category">
        <label htmlFor="series-category">選擇商品分類</label>
        <select id="series-category" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </div>
      <div className="admin-series-content">
        <ul aria-label={`${selectedCategory}系列`} className="admin-series-list">
          {visibleSeries.length === 0 ? <li className="admin-series-empty">此分類尚未建立系列。</li> : visibleSeries.map((item, index) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <div className="admin-series-actions">
                <form action={moveAction}>
                  <input name="id" type="hidden" value={item.id} />
                  <button aria-label={`上移 ${item.name}`} disabled={movePending || index === 0} name="direction" type="submit" value="up">↑</button>
                  <button aria-label={`下移 ${item.name}`} disabled={movePending || index === visibleSeries.length - 1} name="direction" type="submit" value="down">↓</button>
                </form>
                <form action={deleteAction}>
                  <input name="id" type="hidden" value={item.id} />
                  <button aria-label={`刪除系列 ${item.name}`} className="admin-series-delete" disabled={deletePending} type="submit">刪除</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <form action={createAction} className="admin-series-create">
          <input name="categoryName" type="hidden" value={selectedCategory} />
          <label htmlFor="new-series-name">新增系列</label>
          <div>
            <input id="new-series-name" maxLength={40} name="name" placeholder="例：Mori flora 漫花系列" required />
            <button className="button" disabled={createPending || !selectedCategory} type="submit">{createPending ? '新增中…' : '新增系列'}</button>
          </div>
          <small>最多 40 個字；新增後即可在同分類商品中複選。</small>
        </form>
      </div>
    </section>
  )
}
