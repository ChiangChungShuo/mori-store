'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { signIn, signUp, type AuthActionState } from './actions'

const initialState: AuthActionState = { ok: false }

type AuthFormProps = {
  mode: 'sign-in' | 'sign-up'
  nextPath?: string
  fixtureMode?: boolean
}

export function AuthForm({ mode, nextPath, fixtureMode = false }: AuthFormProps) {
  const isSignIn = mode === 'sign-in'
  const [showPassword, setShowPassword] = useState(false)
  const authAction = isSignIn ? signIn : signUp
  const [state, formAction, isPending] = useActionState(
    async (_previousState: AuthActionState, formData: FormData) => authAction(formData),
    initialState,
  )
  const alternateHref = nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : '/signup'
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'

  return (
    <main className="auth-shell">
      <form action={formAction} className="auth-card" noValidate>
        <p className="eyebrow">member account</p>
        <h1>{isSignIn ? '歡迎回到 mori' : '建立你的 mori 帳號'}</h1>
        <p className="auth-intro">{isSignIn ? '登入查看訂單與取貨進度。' : '建立帳號，保存你的訂單與取貨資訊。'}</p>
        {nextPath && <input type="hidden" name="next" value={nextPath} />}
        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" aria-describedby={state.fieldErrors?.email ? 'email-error' : undefined} />
          {state.fieldErrors?.email && <p id="email-error" role="alert">{state.fieldErrors.email[0]}</p>}
        </div>
        <div className="auth-field">
          <label htmlFor="password">密碼</label>
          <div className="password-field">
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} minLength={8} autoComplete={isSignIn ? 'current-password' : 'new-password'} aria-describedby={state.fieldErrors?.password ? 'password-error' : isSignIn ? undefined : 'password-help'} />
            <button type="button" aria-label={showPassword ? '隱藏密碼' : '顯示密碼'} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? '隱藏' : '顯示'}</button>
          </div>
          {!isSignIn && <p className="field-help" id="password-help">至少 8 個字元</p>}
          {state.fieldErrors?.password && <p id="password-error" role="alert">{state.fieldErrors.password[0]}</p>}
        </div>
        {state.message && <p className={state.ok ? 'auth-success' : 'auth-error'} role="status">{state.message}</p>}
        <button className="button button-wide" type="submit" disabled={isPending}>
          {isPending ? '處理中…' : isSignIn ? '登入' : '建立會員帳號'}
        </button>
        <p className="auth-switch">
          {isSignIn ? '第一次來 mori？' : '已經有帳號？'}{' '}
          <Link href={isSignIn ? alternateHref : loginHref}>{isSignIn ? '建立會員帳號' : '前往登入'}</Link>
        </p>
        {fixtureMode && isSignIn && (
          <aside className="demo-account">
            <strong>本機老闆示範帳號</strong>
            <span>admin@mori.tw</span><span>mori123456</span>
            <small>示範會員與訂單只保留到開發伺服器重新啟動前。</small>
          </aside>
        )}
      </form>
      <section className="auth-story" aria-label="mori 會員服務">
        <p className="eyebrow">mori members</p>
        <h2>陪孩子，把每天穿得舒服一點。</h2>
        <p>登入後可查看訂單、取貨門市與付款狀態，讓每一次選衣都簡單安心。</p>
        <ol className="size-track" aria-label="mori 適穿年齡">
          <li>0–2</li><li>3–5</li><li>6–9</li><li>10–12</li>
        </ol>
      </section>
    </main>
  )
}
