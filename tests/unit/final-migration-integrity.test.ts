import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadModule, parseSync } from 'pgsql-parser'
import { beforeAll, describe, expect, it } from 'vitest'

const migrationDirectory = resolve(process.cwd(), 'supabase/migrations')
const migrationFiles = readdirSync(migrationDirectory).sort()
const forwardMigrationName = migrationFiles.find((file) => file.startsWith('202607170008_'))
const forwardMigration = forwardMigrationName
  ? readFileSync(resolve(migrationDirectory, forwardMigrationName), 'utf8')
  : ''
const freshSchema = readFileSync(
  resolve(migrationDirectory, '202607170001_store_schema.sql'),
  'utf8',
)
const oldSchemaFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/c4ad95a-era-store-schema.sql'),
  'utf8',
)

beforeAll(async () => {
  await loadModule()
})

describe('c4ad95a forward migration', () => {
  it('parses the forward migration with the PostgreSQL 17 grammar', () => {
    const parsed = parseSync(forwardMigration)

    expect(parsed.stmts.length).toBeGreaterThan(20)
  })

  it('pins the historical source gaps that 008 must repair', () => {
    expect(oldSchemaFixture).toMatch(/Historical source fixture: commit c4ad95a/i)
    expect(oldSchemaFixture).toMatch(/product_variants[\s\S]*updated_at timestamptz not null/i)
    expect(oldSchemaFixture).toMatch(/create trigger product_variants_set_updated_at/i)
    expect(oldSchemaFixture).not.toMatch(/create type public\.payment_attempt_status/i)
    expect(oldSchemaFixture).not.toMatch(/status public\.payment_attempt_status/i)
    expect(oldSchemaFixture).not.toMatch(/create trigger profiles_protect_member_fields/i)
    expect(oldSchemaFixture).not.toMatch(/create trigger on_auth_user_created/i)
  })

  it('ships one forward-only 008 repair instead of relying on rewritten 001', () => {
    expect(forwardMigrationName ?? '').toMatch(/^202607170008_.+\.sql$/)
    expect(forwardMigration).toMatch(/pg_type[\s\S]*payment_attempt_status/i)
    expect(forwardMigration).toMatch(/add value if not exists 'requires_review'/i)
    expect(forwardMigration).toMatch(/add column if not exists status public\.payment_attempt_status/i)
    expect(forwardMigration).toMatch(/set status = 'pending'/i)
    expect(forwardMigration).toMatch(/alter column status set not null/i)
  })

  it('repairs profile protection and signup for existing auth users idempotently', () => {
    expect(forwardMigration).toMatch(/create or replace function public\.protect_member_profile/i)
    expect(forwardMigration).toMatch(/drop trigger if exists profiles_protect_member_fields/i)
    expect(forwardMigration).toMatch(/create trigger profiles_protect_member_fields/i)
    expect(forwardMigration).toMatch(/create or replace function public\.handle_new_user/i)
    expect(forwardMigration).toMatch(/insert into public\.profiles[\s\S]*from auth\.users/i)
    expect(forwardMigration).toMatch(/drop trigger if exists on_auth_user_created on auth\.users/i)
    expect(forwardMigration).toMatch(/create trigger on_auth_user_created/i)
  })

  it('keeps fresh installs compatible and repairs variant concurrency metadata', () => {
    expect(freshSchema).toMatch(
      /payment_attempt_status as enum \('pending', 'paid', 'failed', 'cancelled', 'requires_review'\)/i,
    )
    expect(freshSchema).toMatch(/product_variants[\s\S]*updated_at timestamptz not null default now\(\)/i)
    expect(forwardMigration).toMatch(/add column if not exists updated_at timestamptz/i)
    expect(forwardMigration).toMatch(/create trigger product_variants_set_updated_at/i)
  })

  it('checks every existing variant version before any product or variant write', () => {
    const adminFunction = forwardMigration.slice(
      forwardMigration.indexOf('function public.admin_update_product'),
      forwardMigration.indexOf('revoke all on function public.admin_update_product'),
    )
    const staleCheck = adminFunction.indexOf("raise exception 'stale_product_variant'")
    const productWrite = adminFunction.indexOf('update public.products')
    const variantWrite = adminFunction.indexOf('update public.product_variants')

    expect(adminFunction).toMatch(/requested\.value ->> 'updatedAt'/i)
    expect(adminFunction).toMatch(/existing\.updated_at is distinct from/i)
    expect(staleCheck).toBeGreaterThan(-1)
    expect(productWrite).toBeGreaterThan(staleCheck)
    expect(variantWrite).toBeGreaterThan(staleCheck)
  })

  it('locks products before variants and compares the authoritative catalog snapshot', () => {
    const paymentFunction = forwardMigration.slice(
      forwardMigration.indexOf('function public.complete_test_payment'),
    )
    const productLock = paymentFunction.indexOf('from public.products')
    const variantLock = paymentFunction.indexOf('from public.product_variants')

    expect(productLock).toBeGreaterThan(-1)
    expect(variantLock).toBeGreaterThan(productLock)
    expect(paymentFunction).toMatch(/order by products\.id[\s\S]*for update/i)
    expect(paymentFunction).toMatch(/order by product_variants\.id[\s\S]*for update/i)
    expect(paymentFunction).toMatch(/is_published/i)
    expect(paymentFunction).toMatch(/is_active/i)
    for (const snapshotField of ['product_name', 'sku', 'color', 'size', 'unit_price']) {
      expect(paymentFunction).toContain(snapshotField)
    }
  })

  it('persists typed review conflicts without raising away the status update', () => {
    expect(forwardMigration).toMatch(/create type public\.payment_completion_result/i)
    expect(forwardMigration).toMatch(/review_code text/i)
    expect(forwardMigration).toMatch(/review_reason text/i)
    expect(forwardMigration).toMatch(/status = 'requires_review'/i)
    expect(forwardMigration).toMatch(/return row\([\s\S]*?'requires_review'/i)
    expect(forwardMigration).toMatch(
      /revoke all on function public\.complete_test_payment\(uuid, text\) from public, anon, authenticated/i,
    )
    expect(forwardMigration).toMatch(
      /grant execute on function public\.complete_test_payment\(uuid, text\) to service_role/i,
    )
  })
})
