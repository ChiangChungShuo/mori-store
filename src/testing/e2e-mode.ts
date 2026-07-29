export type E2EEnvironment = {
  NODE_ENV?: string
  MORI_E2E_FIXTURES?: string
  VERCEL_ENV?: string
}

export function isE2EMode(environment: E2EEnvironment = process.env) {
  const localFixture = environment.NODE_ENV !== 'production'
    && environment.MORI_E2E_FIXTURES === '1'
  return localFixture || environment.VERCEL_ENV === 'preview'
}
