'use client'

import { useActionState, useState } from 'react'
import { useActionToast } from '@/components/toast'
import type { ProductSeries, SeriesActionState } from '@/features/catalog/product-series'

type SeriesAction = (state: SeriesActionState, formData: FormData) => Promise<SeriesActionState>
type PresetState = { ok: boolean; message: string }
type PresetAction = (state: PresetState, formData: FormData) => Promise<PresetState>

export function SeriesManager({
  categories,
  series,
  seriesPresets = [],
  createSeries,
  moveSeries,
  deleteSeries,
  createPreset,
  deletePreset,
}: {
  categories: string[]
  series: ProductSeries[]
  seriesPresets?: string[]
  createSeries: SeriesAction
  moveSeries: SeriesAction
  deleteSeries: SeriesAction
  createPreset?: PresetAction
  deletePreset?: PresetAction
}) {
  const [selectedCategory, setSelectedCategory] = useState(categories[0] ?? '')
  const [createState, createAction, createPending] = useActionState(createSeries, { ok: false, message: '' })
  const [moveState, moveAction, movePending] = useActionState(moveSeries, { ok: false, message: '' })
  const [deleteState, deleteAction, deletePending] = useActionState(deleteSeries, { ok: false, message: '' })
  const noopPreset: PresetAction = async () => ({ ok: false, message: '' })
  const [presetState, presetAction, presetPending] = useActionState(createPreset ?? noopPreset, { ok: false, message: '' })
  const [presetDeleteState, presetDeleteAction, presetDeletePending] = useActionState(deletePreset ?? noopPreset, { ok: false, message: '' })
  useActionToast(createState)
  useActionToast(moveState)
  useActionToast(deleteState)
  useActionToast(presetState)
  useActionToast(presetDeleteState)

  const visibleSeries = series
    .filter((item) => item.categoryName === selectedCategory)
    .sort((first, second) => first.position - second.position)
  const usedNames = new Set(visibleSeries.map((item) => item.name.toLocaleLowerCase('zh-Hant')))

  return (
    <section className="admin-panel admin-series-manager">
      <header>
        <div><p className="eyebrow">catalog series</p><h2>系列管理</h2></div>
        <p>先選分類，再點擊常用系列或手動輸入，建立該分類的系列與前台顯示順序。</p>
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

        {createPreset && deletePreset ? <div className="admin-series-presets">
          <p className="admin-series-presets-title">常用系列<small>點擊即可加入「{selectedCategory || '目前分類'}」，同一個系列名稱可用在多個分類。</small></p>
          <div className="admin-series-preset-chips" aria-label="常用系列">
            {seriesPresets.length === 0
              ? <small>尚未建立常用系列。新增系列後會自動記住名稱，之後其他分類就能一鍵加入。</small>
              : seriesPresets.map((name) => {
                const added = usedNames.has(name.toLocaleLowerCase('zh-Hant'))
                return (
                  <span className="admin-series-preset-chip" data-added={added} key={name}>
                    {/* No confirm dialog: this is a one-click additive action meant
                        for repeated use, and it is undone with 刪除 next to the series. */}
                    <form action={createAction} data-no-confirm>
                      <input name="categoryName" type="hidden" value={selectedCategory} />
                      <input name="name" type="hidden" value={name} />
                      <button
                        aria-label={added ? `${name}（此分類已加入）` : `將 ${name} 加入 ${selectedCategory}`}
                        disabled={added || createPending || !selectedCategory}
                        type="submit"
                      >
                        <span aria-hidden="true">{added ? '✓' : '＋'}</span>{name}
                      </button>
                    </form>
                    <form action={presetDeleteAction}>
                      <input name="kind" type="hidden" value="series" />
                      <input name="value" type="hidden" value={name} />
                      <button
                        aria-label={`從常用系列移除 ${name}`}
                        className="admin-series-preset-remove"
                        disabled={presetDeletePending}
                        type="submit"
                      >×</button>
                    </form>
                  </span>
                )
              })}
          </div>
          <form action={presetAction} className="admin-series-preset-create">
            <input name="kind" type="hidden" value="series" />
            <label htmlFor="new-series-preset">新增常用系列</label>
            <div>
              <input id="new-series-preset" maxLength={40} name="value" placeholder="例：Mori flora 漫花系列" required />
              <button disabled={presetPending} type="submit">{presetPending ? '新增中…' : '加入常用'}</button>
            </div>
            <small>只加入上方常用清單，不會直接建立到分類；要建立請再點擊該系列。</small>
          </form>
        </div> : null}

        <form action={createAction} className="admin-series-create">
          <input name="categoryName" type="hidden" value={selectedCategory} />
          <label htmlFor="new-series-name">直接新增到此分類</label>
          <div>
            <input id="new-series-name" maxLength={40} name="name" placeholder="例：Mori flora 漫花系列" required />
            <button className="button" disabled={createPending || !selectedCategory} type="submit">{createPending ? '新增中…' : '新增系列'}</button>
          </div>
          <small>最多 40 個字；新增後即可在同分類商品中複選，名稱也會自動加入上方常用清單。</small>
        </form>
      </div>
    </section>
  )
}
