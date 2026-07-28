import { SignupForm } from '@/features/auth/signup-form'
import { safeNextPath } from '@/lib/auth/protection'
import { isE2EMode } from '@/testing/e2e-mode'

type SignupPageProps = {
  searchParams: Promise<{ next?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next } = await searchParams

  return <SignupForm fixtureMode={isE2EMode()} nextPath={safeNextPath(next) ?? undefined} />
}
