import { AuthForm } from '@/features/auth/auth-form'
import { safeNextPath } from '@/lib/auth/protection'
import { isE2EMode } from '@/testing/e2e-mode'

type SignupPageProps = {
  searchParams: Promise<{ next?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next } = await searchParams

  return <AuthForm fixtureMode={isE2EMode()} mode="sign-up" nextPath={safeNextPath(next) ?? undefined} />
}
