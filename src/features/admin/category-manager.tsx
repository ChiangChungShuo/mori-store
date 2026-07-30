'use client'

import { useActionState } from 'react'

type CategoryState = { ok: boolean; message: string }
type CategoryAction = (state: CategoryState, formData: FormData) => Promise<CategoryState>

export function CategoryManager({
  categories,
  createCategory,
  deleteCategory,
}: {
  categories: string[]
  createCategory: CategoryAction
  deleteCategory: CategoryAction
}) {
  const [state, formAction, pending] = useActionState(createCategory, { ok: false, message: '' })
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteCategory, { ok: false, message: '' })

  return (
    <section className="admin-panel admin-category-manager">
      <header><div><p className="eyebrow">catalog structure</p><h2>分類清單</h2></div><p>新增或刪除後會同步到前台分類選單與商品新增、編輯表單。</p></header>
      <div className="admin-category-content">
        <div className="admin-category-list" aria-label="目前商品分類">
          {categories.length === 0 ? <small>尚未建立任何分類。</small> : categories.map((category) => (
            <form action={deleteFormAction} className="admin-category-chip" key={category}>
              <span>{category}</span>
              <input name="name" type="hidden" value={category} />
              <button aria-label={`刪除分類 ${category}`} className="admin-category-delete" disabled={deletePending} type="submit">×</button>
            </form>
          ))}
        </div>
        {deleteState.message ? <p aria-live="polite" data-success={deleteState.ok}>{deleteState.message}</p> : null}
        <form action={formAction}>
          <label htmlFor="new-category-name">新增分類</label>
          <div><input id="new-category-name" maxLength={24} name="name" placeholder="例：親子配件" required /><button className="button" disabled={pending} type="submit">{pending ? '新增中…' : '新增分類'}</button></div>
          {state.message ? <p aria-live="polite" data-success={state.ok}>{state.message}</p> : <small>最多 24 個字，新增後即可在商品資料中選用。</small>}
        </form>
      </div>
    </section>
  )
}
