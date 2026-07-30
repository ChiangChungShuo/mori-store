import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationName = readdirSync(resolve(process.cwd(), 'supabase/migrations'))
  .find((name) => name.endsWith('_preserve_order_history_on_product_delete.sql'))
const migrationPath = resolve(process.cwd(), 'supabase/migrations', migrationName ?? 'missing.sql')

describe('product deletion order-history migration', () => {
  it('detaches deleted catalog records while keeping immutable order snapshots', () => {
    expect(migrationName).toBeDefined()
    const migration = readFileSync(migrationPath, 'utf8')

    expect(migration).toMatch(/alter column product_id drop not null/i)
    expect(migration).toMatch(/alter column variant_id drop not null/i)
    expect(migration).toMatch(/foreign key \(product_id\)[\s\S]*on delete set null/i)
    expect(migration).toMatch(/foreign key \(variant_id\)[\s\S]*on delete set null/i)
    expect(migration).toMatch(/new\.product_id is null/i)
    expect(migration).toMatch(/new\.variant_id is null/i)
    expect(migration).toMatch(/new\.product_name is not distinct from old\.product_name/i)
    expect(migration).toMatch(/new\.unit_price is not distinct from old\.unit_price/i)
  })

  it('marks detached order item references as nullable in generated types', () => {
    const databaseTypes = readFileSync(resolve(process.cwd(), 'src/types/database.ts'), 'utf8')
    const orderItems = databaseTypes.slice(
      databaseTypes.indexOf('order_items:'),
      databaseTypes.indexOf('orders:', databaseTypes.indexOf('order_items:')),
    )

    expect(orderItems).toMatch(/product_id: string \| null/)
    expect(orderItems).toMatch(/variant_id: string \| null/)
  })
})
