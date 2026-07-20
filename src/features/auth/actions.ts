'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { safeNextPath } from '@/lib/auth/protection'
import { createClient } from '@/lib/supabase/server'
import { isE2EMode } from '@/testing/e2e-mode'

export type AuthActionState = {
  ok: boolean
  fieldErrors?: { email?: string[]; password?: string[] }
  message?: string
}

const credentialsSchema = z.object({
  email: z.string().trim().email('請輸入有效的 Email'),
  password: z.string().min(8, '密碼至少需要 8 個字元'),
})

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

export async function signIn(formData: FormData): Promise<AuthActionState> {
  const credentials = validateCredentials(formData)

  if ('state' in credentials) {
    return credentials.state
  }

  if (isE2EMode()) {
    const { signInE2E } = await import('@/testing/e2e-auth-repository')
    const user = await signInE2E(credentials.data.email, credentials.data.password)
    if (!user) return { ok: false, message: 'Email 或密碼不正確，請再試一次。' }
    redirect(user.role === 'admin' ? '/admin' : credentials.nextPath)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(credentials.data)

  if (error) {
    return { ok: false, message: 'Email 或密碼不正確，請再試一次。' }
  }

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
    return { ok: true, message: '註冊成功，現在可以使用相同帳密登入。' }
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

  return { ok: true, message: '註冊成功，請前往 Email 完成驗證後再登入。' }
}

export async function signOut(): Promise<never> {
  if (isE2EMode()) {
    const { signOutE2E } = await import('@/testing/e2e-auth-repository')
    await signOutE2E()
    redirect('/')
  }
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
