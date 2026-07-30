'use client'

import { useActionState } from 'react'
import { useActionToast } from '@/components/toast'

type PresetState = { ok: boolean; message: string }
type PresetAction = (state: PresetState, formData: FormData) => Promise<PresetState>

export function PresetManager({
  kind,
  title,
  placeholder,
  presets,
  createAction,
  deleteAction,
}: {
  kind: 'material' | 'care' | 'size'
  title: string
  placeholder: string
  presets: string[]
  createAction: PresetAction
  deleteAction: PresetAction
}) {
  const [state, formAction, pending] = useActionState(createAction, { ok: false, message: '' })
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteAction, { ok: false, message: '' })
  useActionToast(state)
  useActionToast(deleteState)

  return (
    <section className="admin-panel admin-category-manager">
      <header><div><p className="eyebrow">catalog presets</p><h2>{title}</h2></div><p>新增後，新增商品時可一鍵帶入。</p></header>
      <div className="admin-category-content">
        <div className="admin-category-list" aria-label={title}>
          {presets.length === 0 ? <small>尚未建立任何項目。</small> : presets.map((value) => (
            <form action={deleteFormAction} className="admin-category-chip" key={value}>
              <span>{value}</span>
              <input name="kind" type="hidden" value={kind} />
              <input name="value" type="hidden" value={value} />
              <button aria-label={`刪除 ${value}`} className="admin-category-delete" disabled={deletePending} type="submit">×</button>
            </form>
          ))}
        </div>
        <form action={formAction}>
          <label htmlFor={`preset-${kind}`}>新增項目</label>
          <input name="kind" type="hidden" value={kind} />
          <div><input id={`preset-${kind}`} maxLength={200} name="value" placeholder={placeholder} required /><button className="button" disabled={pending} type="submit">{pending ? '新增中…' : '新增'}</button></div>
          <small>最多 200 字。</small>
        </form>
      </div>
    </section>
  )
}
