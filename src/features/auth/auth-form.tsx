'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { signIn, signUp, type AuthActionState } from './actions'

const initialState: AuthActionState = { ok: false }

type AuthFormProps = {
  mode: 'sign-in' | 'sign-up'
  nextPath?: string
}

export function AuthForm({ mode, nextPath }: AuthFormProps) {
  const isSignIn = mode === 'sign-in'
  const authAction = isSignIn ? signIn : signUp
  const [state, formAction, isPending] = useActionState(
    async (_previousState: AuthActionState, formData: FormData) => authAction(formData),
    initialState,
  )
  const alternateHref = nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : '/signup'
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'

  return (
    <form action={formAction} className="section" noValidate>
      <h1>{isSignIn ? '登入會員' : '註冊會員'}</h1>
      {nextPath && <input type="hidden" name="next" value={nextPath} />}
      <p>
        <label htmlFor="email">Email</label><br />
        <input id="email" name="email" type="email" autoComplete="email" aria-describedby="email-error" />
      </p>
      {state.fieldErrors?.email && <p id="email-error" role="alert">{state.fieldErrors.email[0]}</p>}
      <p>
        <label htmlFor="password">密碼</label><br />
        <input id="password" name="password" type="password" autoComplete={isSignIn ? 'current-password' : 'new-password'} aria-describedby="password-error" />
      </p>
      {state.fieldErrors?.password && <p id="password-error" role="alert">{state.fieldErrors.password[0]}</p>}
      {state.message && <p role="status">{state.message}</p>}
      <button className="button" type="submit" disabled={isPending}>
        {isPending ? '處理中…' : isSignIn ? '登入' : '註冊'}
      </button>
      <p>
        {isSignIn ? '還沒有帳戶？' : '已經有帳戶？'}{' '}
        <Link href={isSignIn ? alternateHref : loginHref}>{isSignIn ? '註冊會員' : '前往登入'}</Link>
      </p>
    </form>
  )
}
