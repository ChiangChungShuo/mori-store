'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { safeNextPath } from '@/lib/auth/protection'
import { createClient } from '@/lib/supabase/server'
import { isE2EMode } from '@/testing/e2e-mode'
import { parseLoginIdentifier } from './login-identifier'

export type AuthActionState = {
  ok: boolean
  fieldErrors?: { identifier?: string[]; email?: string[]; password?: string[] }
  message?: string
}

const credentialsSchema = z.object({
  email: z.string().trim().email('請輸入有效的 Email'),
  password: z.string().min(8, '密碼至少需要 8 個字元'),
})

const loginCredentialsSchema = z.object({
  identifier: z.string().trim().min(1, '請輸入 Email 或手機號碼'),
  password: z.string().min(8, '密碼至少需要 8 個字元'),
})

const REMEMBER_LOGIN_COOKIE = 'mori-remember-login'
const THIRTY_DAYS = 60 * 60 * 24 * 30

function validateLoginCredentials(formData: FormData):
  | { identifier: string; password: string; nextPath: string }
  | { state: AuthActionState } {
  const result = loginCredentialsSchema.safeParse({
    identifier: formData.get('identifier') ?? formData.get('email'),
    password: formData.get('password'),
  })
  if (!result.success) {
    return { state: { ok: false, fieldErrors: result.error.flatten().fieldErrors } }
  }

  const identifier = parseLoginIdentifier(result.data.identifier)
  if (!identifier) {
    return {
      state: {
        ok: false,
        fieldErrors: { identifier: ['請輸入有效的 Email 或台灣手機號碼'] },
      },
    }
  }

  return {
    identifier: identifier.value,
    password: result.data.password,
    nextPath: safeNextPath(formData.get('next')?.toString()) ?? '/account',
  }
}

function validateCredentials(formData: FormData):
  | { data: z.infer<typeof credentialsSchema>; nextPath: string }
  | { state: AuthActionState } {
  const result = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!result.success) {
    return {
      state: {
        ok: false,
        fieldErrors: result.error.flatten().fieldErrors,
      },
    }
  }

  return {
    data: result.data,
    nextPath: safeNextPath(formData.get('next')?.toString()) ?? '/account',
  }
}

function loginAfterRegistration(nextPath: string, registration: '1' | 'verify') {
  const query = new URLSearchParams({ registered: registration })
  if (nextPath !== '/account') query.set('next', nextPath)
  return `/login?${query.toString()}`
}

export async function signIn(formData: FormData): Promise<AuthActionState> {
  const credentials = validateLoginCredentials(formData)

  if ('state' in credentials) {
    return credentials.state
  }

  const remember = formData.get('remember') === 'on'

  if (isE2EMode()) {
    const { signInE2E } = await import('@/testing/e2e-auth-repository')
    const user = await signInE2E(credentials.identifier, credentials.password, remember)
    if (!user) return { ok: false, message: '帳號或密碼不正確，請再試一次。' }
    redirect(user.role === 'admin' ? '/admin' : credentials.nextPath)
  }

  let email = credentials.identifier
  if (!email.includes('@')) {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()
      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('id')
        .eq('phone', credentials.identifier)
        .maybeSingle()
      if (profileError || !profile) {
        return { ok: false, message: '帳號或密碼不正確，請再試一次。' }
      }
      const { data, error } = await admin.auth.admin.getUserById(profile.id)
      if (error || !data.user.email) {
        return { ok: false, message: '帳號或密碼不正確，請再試一次。' }
      }
      email = data.user.email
    } catch {
      return { ok: false, message: '帳號或密碼不正確，請再試一次。' }
    }
  }

  const supabase = await createClient({ sessionMaxAge: remember ? THIRTY_DAYS : null })
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: credentials.password,
  })

  if (error) {
    return { ok: false, message: '帳號或密碼不正確，請再試一次。' }
  }

  const cookieStore = await cookies()
  cookieStore.set(REMEMBER_LOGIN_COOKIE, remember ? '1' : '0', {
    httpOnly: true,
    maxAge: remember ? THIRTY_DAYS : undefined,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  redirect(credentials.nextPath)
}

export async function signUp(formData: FormData): Promise<AuthActionState> {
  const credentials = validateCredentials(formData)

  if ('state' in credentials) {
    return credentials.state
  }

  if (isE2EMode()) {
    const { signUpE2E } = await import('@/testing/e2e-auth-repository')
    const result = await signUpE2E(credentials.data.email, credentials.data.password)
    if (result === 'duplicate') {
      return { ok: false, message: '這個 Email 已經註冊，請直接登入。' }
    }
    redirect(loginAfterRegistration(credentials.nextPath, '1'))
  }

  const origin = (await headers()).get('origin')
  const emailRedirectTo = origin
    ? `${origin}/auth/callback?next=${encodeURIComponent(credentials.nextPath)}`
    : undefined
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    ...credentials.data,
    options: { emailRedirectTo },
  })

  if (error) {
    return { ok: false, message: '目前無法完成註冊，請稍後再試。' }
  }

  redirect(loginAfterRegistration(credentials.nextPath, 'verify'))
}

const emailSchema = z.object({
  email: z.string().trim().email('請輸入有效的 Email'),
})

const passwordResetSchema = z.object({
  password: z.string().min(8, '密碼至少需要 8 個字元'),
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  message: '兩次輸入的密碼不一致',
  path: ['confirmPassword'],
})

export type ResetRequestState = {
  ok: boolean
  sent?: boolean
  fieldErrors?: { email?: string[] }
  message?: string
}

export type PasswordUpdateState = {
  ok: boolean
  fieldErrors?: { password?: string[]; confirmPassword?: string[] }
  message?: string
}

// Always responds with a generic success message to avoid revealing whether an email is registered.
export async function requestPasswordReset(formData: FormData): Promise<ResetRequestState> {
  const parsed = emailSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const sentMessage = '如果這個 Email 有註冊帳號，我們已寄出重設密碼的連結，請至信箱查看（含垃圾郵件匣）。'
  if (isE2EMode()) {
    return { ok: true, sent: true, message: sentMessage }
  }

  const origin = (await headers()).get('origin')
  if (origin) {
    const supabase = await createClient()
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    })
  }
  return { ok: true, sent: true, message: sentMessage }
}

export async function updatePassword(formData: FormData): Promise<PasswordUpdateState> {
  const parsed = passwordResetSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  if (isE2EMode()) {
    redirect('/login?reset=1')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: '重設連結已失效或尚未開啟，請重新申請一次。' }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    return { ok: false, message: '目前無法更新密碼，請稍後再試。' }
  }

  await supabase.auth.signOut()
  redirect('/login?reset=1')
}

export async function signOut(): Promise<never> {
  if (isE2EMode()) {
    const { signOutE2E } = await import('@/testing/e2e-auth-repository')
    await signOutE2E()
    redirect('/')
  }
  const supabase = await createClient()
  await supabase.auth.signOut()
  const cookieStore = await cookies()
  cookieStore.delete(REMEMBER_LOGIN_COOKIE)
  redirect('/')
}
