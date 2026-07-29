import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadModule, parseSync } from 'pgsql-parser'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/202607280002_unique_profile_phone.sql',
)

beforeAll(async () => loadModule())

describe('profile phone login migration', () => {
  it('parses and makes non-null member phone numbers unique', () => {
    const migration = readFileSync(migrationPath, 'utf8')

    expect(() => parseSync(migration)).not.toThrow()
    expect(migration).toMatch(/create unique index if not exists profiles_phone_unique/i)
    expect(migration).toMatch(/on public\.profiles \(phone\)/i)
    expect(migration).toMatch(/where phone is not null/i)
  })
})
