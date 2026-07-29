'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { updatePassword, type PasswordUpdateState } from './actions'
import { BrandLogo } from '@/components/brand-logo'

const initialState: PasswordUpdateState = { ok: false }

export function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [state, formAction, isPending] = useActionState(
    async (_previous: PasswordUpdateState, formData: FormData) => updatePassword(formData),
    initialState,
  )

  return (
    <main className="auth-shell">
      <form action={formAction} className="auth-card" noValidate>
        <div className="auth-topbar">
          <Link className="auth-home-link" href="/" aria-label="回到 mori 商城首頁">
            <span className="auth-home-mark"><BrandLogo /></span>
            <span>mori 商城</span>
          </Link>
          <Link className="auth-back-link" href="/login">← 回登入</Link>
        </div>
        <p className="eyebrow">reset password</p>
        <h1>設定新密碼</h1>
        <p className="auth-intro">請輸入新的密碼，完成後即可用新密碼登入。</p>
        <div className="auth-field">
          <label htmlFor="password">新密碼</label>
          <div className="password-field">
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} minLength={8} autoComplete="new-password" aria-describedby={['password-help', state.fieldErrors?.password && 'password-error'].filter(Boolean).join(' ') || undefined} />
            <button type="button" aria-label={showPassword ? '隱藏密碼' : '顯示密碼'} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? '隱藏' : '顯示'}</button>
          </div>
          <p className="field-help" id="password-help">至少 8 個字元</p>
          {state.fieldErrors?.password && <p id="password-error" role="alert">{state.fieldErrors.password[0]}</p>}
        </div>
        <div className="auth-field">
          <label htmlFor="confirmPassword">再次輸入新密碼</label>
          <input id="confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} minLength={8} autoComplete="new-password" aria-describedby={state.fieldErrors?.confirmPassword ? 'confirm-error' : undefined} />
          {state.fieldErrors?.confirmPassword && <p id="confirm-error" role="alert">{state.fieldErrors.confirmPassword[0]}</p>}
        </div>
        {state.message && <p className="auth-error" role="status">{state.message}</p>}
        <button className="button button-wide" type="submit" disabled={isPending}>
          {isPending ? '更新中…' : '更新密碼'}
        </button>
        <p className="auth-switch">連結失效了？ <Link href="/forgot-password">重新申請</Link></p>
      </form>
      <section className="auth-story" aria-label="mori 會員服務">
        <p className="eyebrow">mori members</p>
        <h2>設定好密碼，繼續陪孩子挑選日常。</h2>
        <p>為了帳號安全，請設定至少 8 個字元、不易被猜到的密碼。</p>
      </section>
    </main>
  )
}
