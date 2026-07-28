'use server'

import { redirect } from 'next/navigation'
import { safeNextPath } from '@/lib/auth/protection'
import { createClient } from '@/lib/supabase/server'
import { isE2EMode } from '@/testing/e2e-mode'
import {
  maskEmail,
  signupContactSchema,
  signupOtpSchema,
  signupPasswordSchema,
  type SignupContactState,
  type SignupOtpState,
  type SignupPasswordState,
} from './signup-contract'

export async function requestSignupOtp(formData: FormData): Promise<SignupContactState> {
  const parsed = signupContactSchema.safeParse({
    email: formData.get('email'),
    phone: formData.get('phone'),
    consent: formData.get('consent'),
  })
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { email, phone } = parsed.data
  const termsAcceptedAt = new Date().toISOString()

  if (isE2EMode()) {
    const { requestSignupOtpE2E } = await import('@/testing/e2e-auth-repository')
    const result = await requestSignupOtpE2E(email, phone, termsAcceptedAt)
    if (result === 'duplicate') {
      return { ok: false, message: '目前無法寄出驗證碼，請稍後再試。' }
    }
  } else {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { phone, terms_accepted_at: termsAcceptedAt },
      },
    })
    if (error) {
      return { ok: false, message: '目前無法寄出驗證碼，請稍後再試。' }
    }
  }

  return {
    ok: true,
    email,
    phone,
    maskedEmail: maskEmail(email),
    resendAvailableAt: Date.now() + 60_000,
  }
}

export async function verifySignupOtp(formData: FormData): Promise<SignupOtpState> {
  const parsed = signupOtpSchema.safeParse({
    email: formData.get('email'),
    token: formData.get('token'),
  })
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: { token: parsed.error.flatten().fieldErrors.token },
    }
  }

  if (isE2EMode()) {
    const { verifySignupOtpE2E } = await import('@/testing/e2e-auth-repository')
    const result = await verifySignupOtpE2E(parsed.data.email, parsed.data.token)
    if (result !== 'verified') {
      return { ok: false, message: '驗證碼錯誤或已過期，請重新確認。' }
    }
  } else {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      email: parsed.data.email,
      token: parsed.data.token,
      type: 'email',
    })
    if (error) {
      return { ok: false, message: '驗證碼錯誤或已過期，請重新確認。' }
    }
  }

  return { ok: true, verified: true }
}

export async function completeSignup(formData: FormData): Promise<SignupPasswordState> {
  const password = signupPasswordSchema.safeParse({ password: formData.get('password') })
  if (!password.success) {
    return { ok: false, fieldErrors: password.error.flatten().fieldErrors }
  }

  const email = formData.get('email')?.toString().trim().toLowerCase() ?? ''
  if (!signupOtpSchema.shape.email.safeParse(email).success) {
    return { ok: false, message: '註冊驗證已失效，請重新操作。' }
  }
  const destination = safeNextPath(formData.get('next')?.toString()) ?? '/account'

  if (isE2EMode()) {
    const { completeSignupE2E } = await import('@/testing/e2e-auth-repository')
    const user = await completeSignupE2E(email, password.data.password)
    if (!user) return { ok: false, message: '註冊驗證已失效，請重新操作。' }
  } else {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user || user.email?.toLowerCase() !== email) {
      return { ok: false, message: '註冊驗證已失效，請重新操作。' }
    }
    const { error } = await supabase.auth.updateUser({ password: password.data.password })
    if (error) return { ok: false, message: '目前無法設定密碼，請稍後再試。' }
  }

  redirect(destination)
}
