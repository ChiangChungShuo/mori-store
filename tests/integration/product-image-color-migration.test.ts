import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260802010000_product_image_colors.sql'),
  'utf8',
)

describe('product image color migration', () => {
  it('adds a nullable color and protects both image mutations with admin checks', () => {
    expect(sql).toMatch(/alter table public\.product_images[\s\S]*add column color text/i)
    expect(sql).toContain('admin_insert_product_image')
    expect(sql).toContain('admin_set_product_image_color')
    expect(sql.match(/if not public\.is_admin\(\)/gi)).toHaveLength(2)
    expect(sql).toContain('product_image_color_invalid')
    expect(sql).toContain('grant execute')
  })
})
