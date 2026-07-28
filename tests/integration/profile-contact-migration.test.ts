import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadModule, parseSync } from 'pgsql-parser'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/202607280001_profile_contact_consent.sql',
)

beforeAll(async () => loadModule())

describe('profile contact migration', () => {
  it('parses and adds nullable contact fields idempotently', () => {
    const migration = readFileSync(migrationPath, 'utf8')

    expect(() => parseSync(migration)).not.toThrow()
    expect(migration).toMatch(/add column if not exists phone text/i)
    expect(migration).toMatch(/add column if not exists terms_accepted_at timestamptz/i)
    expect(migration).toMatch(/phone is null or phone ~ '\^09\[0-9\]\{8\}\$'/i)
  })

  it('copies auth metadata and protects contact consent fields', () => {
    const migration = readFileSync(migrationPath, 'utf8')

    expect(migration).toMatch(/raw_user_meta_data ->> 'phone'/i)
    expect(migration).toMatch(/raw_user_meta_data ->> 'terms_accepted_at'/i)
    expect(migration).toMatch(/new\.phone is distinct from old\.phone/i)
    expect(migration).toMatch(/new\.terms_accepted_at is distinct from old\.terms_accepted_at/i)
    expect(migration).toMatch(/drop trigger if exists on_auth_user_created on auth\.users/i)
  })
})
