import { SignupForm } from '@/features/auth/signup-form'
import { getActiveWelcomeGift } from '@/features/marketing/welcome-gift'
import { safeNextPath } from '@/lib/auth/protection'
import { showsDemoCredentials } from '@/testing/e2e-mode'

type SignupPageProps = {
  searchParams: Promise<{ next?: string; email?: string; name?: string }>
}

/**
 * The guest order-complete page passes these along so a shopper who just bought
 * does not retype what they typed at checkout. Treated as untrusted display
 * values only: the Email still has to pass the verification code, so a crafted
 * link cannot register anybody else's address.
 */
function prefillFrom(searchParams: { email?: string; name?: string }) {
  const email = searchParams.email?.trim().slice(0, 160) ?? ''
  const displayName = searchParams.name?.trim().slice(0, 40) ?? ''
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  return looksLikeEmail || displayName
    ? { email: looksLikeEmail ? email.toLowerCase() : undefined, displayName: displayName || undefined }
    : undefined
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams
  const welcomeGift = await getActiveWelcomeGift()

  return (
    <SignupForm
      fixtureMode={showsDemoCredentials()}
      nextPath={safeNextPath(params.next) ?? undefined}
      prefill={prefillFrom(params)}
      welcomeGift={welcomeGift ? { amount: welcomeGift.amount, minimumSpend: welcomeGift.minimumSpend } : null}
    />
  )
}
