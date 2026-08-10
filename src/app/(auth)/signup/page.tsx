import { SignupForm } from '@/features/auth/signup-form'
import { getActiveWelcomeGift } from '@/features/marketing/welcome-gift'
import { safeNextPath } from '@/lib/auth/protection'
import { showsDemoCredentials } from '@/testing/e2e-mode'

type SignupPageProps = {
  searchParams: Promise<{ next?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next } = await searchParams
  const welcomeGift = await getActiveWelcomeGift()

  return (
    <SignupForm
      fixtureMode={showsDemoCredentials()}
      nextPath={safeNextPath(next) ?? undefined}
      welcomeGift={welcomeGift ? { amount: welcomeGift.amount, minimumSpend: welcomeGift.minimumSpend } : null}
    />
  )
}
