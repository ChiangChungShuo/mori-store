import { z } from 'zod'
import { normalizeTaiwanMobile } from './signup-contract'

const emailSchema = z.string().email()
const phoneSchema = z.string().regex(/^09\d{8}$/)

export type LoginIdentifier = {
  type: 'email' | 'phone'
  value: string
}

export function parseLoginIdentifier(input: string): LoginIdentifier | null {
  const email = input.trim().toLowerCase()
  if (emailSchema.safeParse(email).success) return { type: 'email', value: email }

  const phone = normalizeTaiwanMobile(input)
  if (phoneSchema.safeParse(phone).success) return { type: 'phone', value: phone }

  return null
}
