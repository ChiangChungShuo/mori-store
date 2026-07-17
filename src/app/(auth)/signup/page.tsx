import { AuthForm } from '@/features/auth/auth-form'
import { safeNextPath } from '@/lib/auth/protection'

type SignupPageProps = {
  searchParams: Promise<{ next?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next } = await searchParams

  return <AuthForm mode="sign-up" nextPath={safeNextPath(next) ?? undefined} />
}
