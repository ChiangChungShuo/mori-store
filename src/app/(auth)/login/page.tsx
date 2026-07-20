import { AuthForm } from '@/features/auth/auth-form'
import { safeNextPath } from '@/lib/auth/protection'
import { isE2EMode } from '@/testing/e2e-mode'

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams

  return <AuthForm fixtureMode={isE2EMode()} mode="sign-in" nextPath={safeNextPath(next) ?? undefined} />
}
