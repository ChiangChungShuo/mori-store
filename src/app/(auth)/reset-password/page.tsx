import type { Metadata } from 'next'
import { ResetPasswordForm } from '@/features/auth/reset-password-form'

export const metadata: Metadata = {
  title: '重設密碼',
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
