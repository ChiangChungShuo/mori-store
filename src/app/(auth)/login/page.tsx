import { AuthForm } from '@/features/auth/auth-form'
import { safeNextPath } from '@/lib/auth/protection'

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams

  return <AuthForm mode="sign-in" nextPath={safeNextPath(next) ?? undefined} />
}
