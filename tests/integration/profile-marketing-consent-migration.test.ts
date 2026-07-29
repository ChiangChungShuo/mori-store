import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadModule, parseSync } from 'pgsql-parser'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/202607280003_profile_marketing_consent.sql',
)

beforeAll(async () => loadModule())

describe('profile marketing consent migration', () => {
  it('parses and persists optional signup consent separately from legal consent', () => {
    const migration = readFileSync(migrationPath, 'utf8')

    expect(() => parseSync(migration)).not.toThrow()
    expect(migration).toMatch(/add column if not exists marketing_consent_at timestamptz/i)
    expect(migration).toMatch(/raw_user_meta_data ->> 'marketing_consent_at'/i)
    expect(migration).toMatch(/new\.marketing_consent_at is distinct from old\.marketing_consent_at/i)
  })
})
