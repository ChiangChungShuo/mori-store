export type E2EEnvironment = {
  NODE_ENV?: string
  MORI_E2E_FIXTURES?: string
  VERCEL_ENV?: string
}

export function isE2EMode(environment: E2EEnvironment = process.env) {
  const localFixture = environment.NODE_ENV !== 'production'
    && environment.MORI_E2E_FIXTURES === '1'
  // Preview deployments run on fixtures too, which is what keeps them away from
  // production data (the Supabase keys are scoped to Production only).
  return localFixture || environment.VERCEL_ENV === 'preview'
}

/**
 * Whether the shared demo credentials may be printed on the sign-in page.
 *
 * Fixture mode alone is not enough: Vercel preview builds also run on fixtures
 * and their URLs are reachable by anyone, so the demo account is limited to a
 * developer's own machine.
 */
export function showsDemoCredentials(environment: E2EEnvironment = process.env) {
  return isE2EMode(environment) && !environment.VERCEL_ENV
}
