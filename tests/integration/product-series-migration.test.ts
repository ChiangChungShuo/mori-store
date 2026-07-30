import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationName = readdirSync(resolve(process.cwd(), 'supabase/migrations'))
  .find((name) => name.endsWith('_product_series.sql'))
const assignmentMigrationName = readdirSync(resolve(process.cwd(), 'supabase/migrations'))
  .find((name) => name.endsWith('_product_series_assignments.sql'))

describe('product series migration', () => {
  it('creates category-specific series and product assignments safely', () => {
    expect(migrationName).toBeDefined()
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations', migrationName ?? 'missing.sql'),
      'utf8',
    )

    expect(migration).toMatch(/create table public\.product_series/i)
    expect(migration).toMatch(/category_name text not null references public\.product_categories\(name\)/i)
    expect(migration).toMatch(/create unique index product_series_category_name_unique[\s\S]*lower\(btrim\(name\)\)/i)
    expect(migration).toMatch(/create table public\.product_series_products/i)
    expect(migration).toMatch(/product_id uuid not null references public\.products\(id\) on delete cascade/i)
    expect(migration).toMatch(/series_id uuid not null references public\.product_series\(id\) on delete restrict/i)
    expect(migration).toMatch(/create trigger validate_product_series_category/i)
    expect(migration).toMatch(/alter table public\.product_series enable row level security/i)
    expect(migration).toMatch(/alter table public\.product_series_products enable row level security/i)
    expect(migration).toMatch(/grant select on public\.product_series to anon, authenticated/i)
    expect(migration).toMatch(/grant select on public\.product_series_products to anon, authenticated/i)
  })

  it('keeps the generated database types aligned with both tables', () => {
    const databaseTypes = readFileSync(resolve(process.cwd(), 'src/types/database.ts'), 'utf8')
    expect(databaseTypes).toMatch(/product_series: \{[\s\S]*category_name: string[\s\S]*position: number/)
    expect(databaseTypes).toMatch(/product_series_products: \{[\s\S]*product_id: string[\s\S]*series_id: string/)
  })

  it('validates and atomically replaces product series assignments in the product RPC', () => {
    expect(assignmentMigrationName).toBeDefined()
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations', assignmentMigrationName ?? 'missing.sql'),
      'utf8',
    )

    expect(migration).toMatch(/p_product\s*->\s*'seriesIds'/i)
    expect(migration).toMatch(/product_series_category_mismatch/i)
    expect(migration).toMatch(/delete from public\.product_series_products[\s\S]*where product_id = p_product_id/i)
    expect(migration).toMatch(/insert into public\.product_series_products \(product_id, series_id\)/i)
    expect(migration).toMatch(/create or replace function public\.admin_update_product/i)
  })
})
