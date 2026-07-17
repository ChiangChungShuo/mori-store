import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const schema = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607170001_store_schema.sql'),
  'utf8',
)
const migrations = readdirSync(resolve(process.cwd(), 'supabase/migrations'))
  .map((file) => readFileSync(resolve(process.cwd(), 'supabase/migrations', file), 'utf8'))
  .join('\n')
const databaseTypes = readFileSync(resolve(process.cwd(), 'src/types/database.ts'), 'utf8')
const checkoutService = readFileSync(
  resolve(process.cwd(), 'src/features/checkout/service.ts'),
  'utf8',
)

describe('store schema security invariants', () => {
  it('prevents members from escalating their own profile role', () => {
    expect(schema).toMatch(/create trigger profiles_protect_member_fields/i)
    expect(schema).toMatch(/if auth\.role\(\) = 'authenticated'\s+and not public\.is_admin\(\)/i)
    expect(schema).toMatch(/raise exception 'members may only update display_name'/i)
  })

  it('creates a customer profile for every auth signup', () => {
    expect(schema).toMatch(/create trigger on_auth_user_created/i)
    expect(schema).toMatch(/values \(new\.id, .*'customer'\)/i)
  })

  it('models payment lifecycle states', () => {
    expect(schema).toMatch(/create type public\.payment_attempt_status as enum \('pending', 'paid', 'failed', 'cancelled'\)/i)
    expect(schema).toMatch(/status public\.payment_attempt_status not null default 'pending'/i)
  })

  it('stores only a SHA-256 guest payment access token hash', () => {
    expect(migrations).toMatch(/payment_access_token_hash text/i)
    expect(migrations).toMatch(/payment_access_token_hash ~ '\^\[0-9a-f\]\{64\}\$'/i)
    expect(databaseTypes).toMatch(/payment_access_token_hash: string \| null/i)
    expect(checkoutService).toMatch(/randomBytes\(32\)\.toString\('base64url'\)/)
    expect(checkoutService).toMatch(/httpOnly: true/)
    expect(checkoutService).toMatch(/sameSite: 'lax'/)
    expect(checkoutService).toMatch(/path: '\/'/)
  })

  it('aggregates and locks variants in UUID order before decrementing stock', () => {
    expect(schema).toMatch(/sum\(\(entry\.value ->> 'quantity'\)::integer\)::integer as quantity/i)
    expect(schema).toMatch(/order by requested\.variant_id/i)
    expect(schema).toMatch(/for update;/i)
  })

  it('normalizes order and payment-attempt emails', () => {
    expect(schema).toMatch(/check \(email = lower\(btrim\(email\)\)\)/i)
    expect(schema).toMatch(/lower\(btrim\(payment\.email\)\)/i)
  })
})
