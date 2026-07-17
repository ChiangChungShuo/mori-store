import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const schema = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607170001_store_schema.sql'),
  'utf8',
)

describe('store schema security invariants', () => {
  it('prevents members from escalating their own profile role', () => {
    expect(schema).toMatch(/create trigger profiles_protect_member_fields/i)
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
