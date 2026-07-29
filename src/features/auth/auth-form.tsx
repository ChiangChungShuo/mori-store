'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { signIn, signUp, type AuthActionState } from './actions'
import { BrandLogo } from '@/components/brand-logo'

const initialState: AuthActionState = { ok: false }

type AuthFormProps = {
  mode: 'sign-in' | 'sign-up'
  nextPath?: string
  fixtureMode?: boolean
  notice?: string
}

export function AuthForm({ mode, nextPath, fixtureMode = false, notice }: AuthFormProps) {
  const isSignIn = mode === 'sign-in'
  const [showPassword, setShowPassword] = useState(false)
  const authAction = isSignIn ? signIn : signUp
  const [state, formAction, isPending] = useActionState(
    async (_previousState: AuthActionState, formData: FormData) => authAction(formData),
    initialState,
  )
  const alternateHref = nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : '/signup'
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'
  const passwordDescription = [
    !isSignIn && 'password-help',
    state.fieldErrors?.password && 'password-error',
  ].filter(Boolean).join(' ') || undefined
  const identifierError = isSignIn ? state.fieldErrors?.identifier : state.fieldErrors?.email

  return (
    <main className="auth-shell">
      <form action={formAction} className="auth-card" noValidate>
        <div className="auth-topbar">
          <Link className="auth-home-link" href="/" aria-label="回到 mori 商城首頁">
            <span className="auth-home-mark"><BrandLogo /></span>
            <span>mori 商城</span>
          </Link>
          <Link className="auth-back-link" href="/products">先逛逛商品 →</Link>
        </div>
        <p className="eyebrow">member account</p>
        <h1>{isSignIn ? '歡迎回到 mori' : '建立你的 mori 帳號'}</h1>
        <p className="auth-intro">{isSignIn ? '登入查看訂單與取貨進度。' : '建立帳號，保存你的訂單與取貨資訊。'}</p>
        {notice && <p className="auth-success" role="status">{notice}</p>}
        {nextPath && <input type="hidden" name="next" value={nextPath} />}
        <div className="auth-field">
          <label htmlFor={isSignIn ? 'identifier' : 'email'}>{isSignIn ? 'Email 或手機號碼' : 'Email'}</label>
          <input
            id={isSignIn ? 'identifier' : 'email'}
            name={isSignIn ? 'identifier' : 'email'}
            type={isSignIn ? 'text' : 'email'}
            autoComplete={isSignIn ? 'username' : 'email'}
            autoFocus
            inputMode={isSignIn ? 'text' : 'email'}
            aria-describedby={identifierError ? 'identifier-error' : undefined}
          />
          {identifierError && <p id="identifier-error" role="alert">{identifierError[0]}</p>}
        </div>
        <div className="auth-field">
          <label htmlFor="password">密碼</label>
          <div className="password-field">
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} minLength={8} autoComplete={isSignIn ? 'current-password' : 'new-password'} aria-describedby={passwordDescription} />
            <button type="button" aria-label={showPassword ? '隱藏密碼' : '顯示密碼'} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? '隱藏' : '顯示'}</button>
          </div>
          {!isSignIn && <p className="field-help" id="password-help">至少 8 個字元</p>}
          {state.fieldErrors?.password && <p id="password-error" role="alert">{state.fieldErrors.password[0]}</p>}
          {isSignIn && <p className="auth-forgot"><Link href="/forgot-password">忘記密碼？</Link></p>}
        </div>
        {isSignIn && (
          <label className="auth-remember-check">
            <input name="remember" type="checkbox" value="on" />
            <span>記住我（30 天內不用重新登入）</span>
          </label>
        )}
        {state.message && <p className={state.ok ? 'auth-success' : 'auth-error'} role="status">{state.message}</p>}
        <button className="button button-wide" type="submit" disabled={isPending}>
          {isPending ? '處理中…' : isSignIn ? '登入' : '建立會員帳號'}
        </button>
        {!isSignIn && (
          <p className="auth-consent">建立帳號即表示你已閱讀並同意 <Link href="/terms">服務條款</Link> 與 <Link href="/privacy">隱私權政策</Link>。</p>
        )}
        <p className="auth-guest-note">不想註冊？也可以直接<Link href="/products">以訪客身分購物</Link>。</p>
        <p className={isSignIn ? 'auth-switch auth-create-account' : 'auth-switch'}>
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
