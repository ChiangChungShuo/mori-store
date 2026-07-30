import { z } from 'zod'

export function normalizeTaiwanMobile(value: string) {
  return value.trim().replace(/[\s-]/g, '')
}

export function maskEmail(email: string) {
  const [local, domain = ''] = email.toLowerCase().split('@')
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`
}

export const signupContactSchema = z.object({
  displayName: z.string().trim().min(2, '請輸入真實姓名').max(40, '姓名請勿超過 40 個字元'),
  email: z.string().trim().toLowerCase().email('請輸入有效的 Email'),
  phone: z.string().transform(normalizeTaiwanMobile)
    .pipe(z.string().regex(/^09\d{8}$/, '請輸入有效的台灣手機號碼')),
  consent: z.literal('on', { error: '請先同意服務條款與隱私權政策' }),
  marketingConsent: z.literal('on').optional(),
})

export const signupOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().trim().regex(/^\d{6,10}$/, '請輸入信件中的數字驗證碼'),
})

export const signupPasswordSchema = z.object({
  password: z.string().min(8, '密碼至少需要 8 個字元'),
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  message: '兩次輸入的密碼不一致',
  path: ['confirmPassword'],
})

export type SignupContactState = {
  ok: boolean
  displayName?: string
  email?: string
  phone?: string
  marketingConsent?: boolean
  maskedEmail?: string
  resendAvailableAt?: number
  fieldErrors?: { displayName?: string[]; email?: string[]; phone?: string[]; consent?: string[] }
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
  fieldErrors?: { password?: string[]; confirmPassword?: string[] }
  message?: string
}
