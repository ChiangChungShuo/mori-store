import { z } from 'zod'

export function normalizeTaiwanMobile(value: string) {
  return value.trim().replace(/[\s-]/g, '')
}

export function maskEmail(email: string) {
  const [local, domain = ''] = email.toLowerCase().split('@')
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`
}

export const signupContactSchema = z.object({
  email: z.string().trim().toLowerCase().email('請輸入有效的 Email'),
  phone: z.string().transform(normalizeTaiwanMobile)
    .pipe(z.string().regex(/^09\d{8}$/, '請輸入有效的台灣手機號碼')),
  consent: z.literal('on', { error: '請先同意服務條款與隱私權政策' }),
})

export const signupOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().trim().regex(/^\d{6}$/, '請輸入 6 位數驗證碼'),
})

export const signupPasswordSchema = z.object({
  password: z.string().min(8, '密碼至少需要 8 個字元'),
})

export type SignupContactState = {
  ok: boolean
  email?: string
  phone?: string
  maskedEmail?: string
  resendAvailableAt?: number
  fieldErrors?: { email?: string[]; phone?: string[]; consent?: string[] }
  message?: string
}

export type SignupOtpState = {
  ok: boolean
  verified?: boolean
  fieldErrors?: { token?: string[] }
  message?: string
}

export type SignupPasswordState = {
  ok: boolean
  fieldErrors?: { password?: string[] }
  message?: string
}
