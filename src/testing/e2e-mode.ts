export type E2EEnvironment = { NODE_ENV?: string; MORI_E2E_FIXTURES?: string }

export function isE2EMode(environment: E2EEnvironment = process.env) {
  return environment.NODE_ENV !== 'production' && environment.MORI_E2E_FIXTURES === '1'
}
