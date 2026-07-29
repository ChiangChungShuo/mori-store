import { AuthForm } from '@/features/auth/auth-form'
import { safeNextPath } from '@/lib/auth/protection'
import { isE2EMode } from '@/testing/e2e-mode'

type LoginPageProps = {
  searchParams: Promise<{ next?: string; registered?: string; reset?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, registered, reset } = await searchParams
  const notice = reset === '1'
    ? '密碼已更新，請用新密碼登入。'
    : registered === 'verify'
      ? '註冊成功，請先前往 Email 完成驗證，再使用帳密登入。'
      : registered === '1'
        ? '註冊成功，請使用剛才設定的 Email 與密碼登入。'
        : undefined

  return <AuthForm fixtureMode={isE2EMode()} mode="sign-in" nextPath={safeNextPath(next) ?? undefined} notice={notice} />
}
