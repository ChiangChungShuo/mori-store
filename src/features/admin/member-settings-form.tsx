'use client'

import { useActionState } from 'react'
import { useActionToast } from '@/components/toast'
import type { MemberUpdateState } from '@/features/admin/business-management'

export function MemberSettingsForm({
  email,
  tier,
  points,
  discountPercent,
  labels,
  action,
}: {
  email: string
  tier: string
  points: number
  discountPercent: number
  labels: Record<string, string>
  action: (state: MemberUpdateState, formData: FormData) => Promise<MemberUpdateState>
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: '' })
  useActionToast(state)

  return (
    <form action={formAction} className="member-settings-form">
      <input name="email" type="hidden" value={email} />
      <label>等級<select defaultValue={tier} name="tier">{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>紅利點數<input defaultValue={points} min="0" name="points" type="number" /></label>
      <label>專屬折扣 %<input defaultValue={discountPercent} max="100" min="0" name="discountPercent" type="number" /></label>
      <button type="submit" disabled={pending}>{pending ? '更新中…' : '更新會員'}</button>
    </form>
  )
}
