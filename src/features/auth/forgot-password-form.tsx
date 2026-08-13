'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { requestPasswordReset, type ResetRequestState } from './actions'
import { BrandLogo } from '@/components/brand-logo'

const initialState: ResetRequestState = { ok: false }

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    async (_previous: ResetRequestState, formData: FormData) => requestPasswordReset(formData),
    initialState,
  )

  return (
    <main className="auth-shell">
      <form action={formAction} className="auth-card" noValidate>
        <div className="auth-topbar">
          <Link className="auth-home-link" href="/" aria-label="回到 MORIMUR BABY 商城首頁">
            <span className="auth-home-mark"><BrandLogo /></span>
            <span>MORIMUR BABY</span>
          </Link>
          <Link className="auth-back-link" href="/login">← 回登入</Link>
        </div>
        <p className="eyebrow">reset password</p>
        <h1>忘記密碼？</h1>
        <p className="auth-intro">輸入註冊時的 Email，我們會寄送重設密碼的連結給你。</p>
        {state.sent ? (
          <p className="auth-success" role="status">{state.message}</p>
        ) : (
          <>
            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" autoFocus inputMode="email" aria-describedby={state.fieldErrors?.email ? 'email-error' : undefined} />
              {state.fieldErrors?.email && <p id="email-error" role="alert">{state.fieldErrors.email[0]}</p>}
            </div>
            <button className="button button-wide" type="submit" disabled={isPending}>
              {isPending ? '寄送中…' : '寄送重設連結'}
            </button>
          </>
        )}
        <p className="auth-switch">想起密碼了？ <Link href="/login">前往登入</Link></p>
      </form>
      <section className="auth-story" aria-label="MORIMUR BABY 會員服務">
        <p className="eyebrow">MORIMUR BABY members</p>
        <h2>幾秒鐘，重新拿回你的帳號。</h2>
        <p>收到信後點擊連結即可設定新密碼；沒收到請確認垃圾郵件匣，或稍候再試一次。</p>
      </section>
    </main>
  )
}
