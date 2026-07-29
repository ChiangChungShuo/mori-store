import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form'

export const metadata: Metadata = {
  title: '忘記密碼',
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
