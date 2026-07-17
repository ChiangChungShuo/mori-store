import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const hasLiveData = process.env.HAS_LIVE_DATA === '1'
const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

async function createPaidGuestOrderFixture() {
  if (!supabaseUrl || !secretKey) throw new Error('Supabase fixture credentials are missing')
  const admin = createClient<Database>(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const suffix = randomUUID().replaceAll('-', '')
  const { data: variant, error: variantError } = await admin
    .from('product_variants')
    .select('id, product_id, sku, color, size, price')
    .eq('is_active', true)
    .gt('stock', 0)
    .limit(1)
    .single()
  if (variantError) throw variantError

  const { data: product, error: productError } = await admin
    .from('products')
    .select('name')
    .eq('id', variant.product_id)
    .single()
  if (productError) throw productError

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      email: `e2e-fulfillment-${suffix}@example.com`,
      recipient_name: 'E2E 訪客',
      recipient_phone: '0912345678',
      store_chain: 'seven_eleven',
      store_id: '123456',
      store_name: '台北門市',
      subtotal: variant.price,
      shipping_fee: 60,
      total: variant.price + 60,
      status: 'paid',
    })
    .select('id, order_number')
    .single()
  if (orderError) throw orderError

  const { error: itemError } = await admin.from('order_items').insert({
    order_id: order.id,
    product_id: variant.product_id,
    variant_id: variant.id,
    product_name: product.name,
    sku: variant.sku,
    color: variant.color,
    size: variant.size,
    unit_price: variant.price,
    quantity: 1,
  })
  if (itemError) throw itemError

  const { error: paymentError } = await admin.from('payment_attempts').insert({
    email: `e2e-fulfillment-${suffix}@example.com`,
    recipient_name: 'E2E 訪客',
    recipient_phone: '0912345678',
    store_chain: 'seven_eleven',
    store_id: '123456',
    store_name: '台北門市',
    subtotal: variant.price,
    shipping_fee: 60,
    total: variant.price + 60,
    items: [{ variantId: variant.id, quantity: 1 }],
    status: 'paid',
    provider_reference: `e2e-fulfillment-${suffix}`,
    order_id: order.id,
    paid_at: new Date().toISOString(),
    payment_access_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    payment_access_token_hash: suffix.padEnd(64, '0').slice(0, 64),
  })
  if (paymentError) throw paymentError

  return order.order_number
}

test.describe('admin order fulfillment', () => {
  test.skip(
    !hasLiveData || !email || !password || !supabaseUrl || !secretKey,
    'requires HAS_LIVE_DATA, admin credentials and server-side Supabase fixture credentials',
  )

  test('fulfills a paid order and blocks an invalid reverse transition', async ({ page }) => {
    const paidOrderNumber = await createPaidGuestOrderFixture()

    await page.goto('/login?next=/admin/orders')
    await page.getByLabel('Email').fill(email ?? '')
    await page.getByLabel('密碼').fill(password ?? '')
    await page.getByRole('button', { name: '登入' }).click()
    await expect(page).toHaveURL(/\/admin\/orders$/)

    await page.getByLabel('訂單編號、收件人或 Email').fill(paidOrderNumber ?? '')
    await page.getByRole('button', { name: '篩選' }).click()
    await expect(page).toHaveURL(/\/admin\/orders$/)
    await page.getByRole('link', { name: paidOrderNumber }).click()

    await page.getByRole('button', { name: '開始備貨' }).click()
    await expect(page.getByText('目前狀態：備貨中')).toBeVisible()
    await page.getByRole('button', { name: '標記已出貨' }).click()
    await expect(page.getByText('目前狀態：已出貨')).toBeVisible()
    await page.getByRole('button', { name: '標記已取貨' }).click()
    await expect(page.getByText('目前狀態：已取貨')).toBeVisible()
    await expect(page.getByRole('button', { name: '開始備貨' })).toHaveCount(0)
  })
})
