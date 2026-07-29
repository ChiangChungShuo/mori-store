import { describe, expect, it } from 'vitest'
import { signIn, signUp } from '@/features/auth/actions'

describe('authentication server action contract', () => {
  it('accepts FormData as the sole sign-in argument', async () => {
    const result = await signIn(new FormData())
    expect(result.fieldErrors?.identifier).toBeTruthy()
    expect(result.fieldErrors?.password).toBeTruthy()
  })

  it('accepts FormData as the sole sign-up argument', async () => {
    const result = await signUp(new FormData())
    expect(result.fieldErrors?.email).toBeTruthy()
    expect(result.fieldErrors?.password).toBeTruthy()
  })
})
