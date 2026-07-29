import { expect, test } from '@playwright/test'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const hasLiveData = process.env.HAS_LIVE_DATA === '1'
const variantId = process.env.E2E_GUEST_VARIANT_ID
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseSecret = process.env.SUPABASE_SECRET_KEY

function liveAdmin() {
  if (!supabaseUrl || !supabaseSecret) throw new Error('live Supabase credentials are required')
  return createSupabaseClient(supabaseUrl, supabaseSecret, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function countOrdersForEmail(email: string) {
  const { count, error } = await liveAdmin()
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('email', email)
  if (error) throw error
  return count ?? 0
}

async function getVariantStock(id: string) {
  const { data, error } = await liveAdmin()
    .from('product_variants')
    .select('stock')
    .eq('id', id)
    .single()
  if (error) throw error
  return data.stock
}

test.describe('guest checkout', () => {
  test.skip(
    !hasLiveData || !variantId || !supabaseUrl || !supabaseSecret,
    'requires live data, a guest variant, and Node-only Supabase admin credentials',
  )

  test('keeps the cart after failure and clears it after an idempotent success', async ({ page }) => {
    const email = `e2e-guest-${Date.now()}@example.com`
    await page.goto('/')
    await page.evaluate((id) => {
      window.localStorage.setItem('mori-cart-v1', JSON.stringify([{
        variantId: id,
        productSlug: 'mori-organic-cotton-tee',
        name: '有機棉小樹 T 恤',
        imageUrl: null,
        color: '鼠尾草綠',
        size: '100',
        unitPrice: 1,
        quantity: 1,
        maxStock: 5,
      }]))
    }, variantId)

    await page.goto('/checkout')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('收件人姓名').fill('王小美')
    await page.getByLabel('手機號碼').fill('0912345678')
    await page.getByRole('radio', { name: '7-ELEVEN', exact: true }).check()
    await page.getByLabel('取貨門市名稱').fill('台北門市')
    await page.getByLabel('門市店號').fill('123456')
    await page.getByRole('button', { name: '前往測試付款' }).click()

    await expect(page).toHaveURL(/\/checkout\/payment\/[0-9a-f-]+$/)
    await page.getByRole('button', { name: '模擬付款失敗' }).click()
    await expect(page).toHaveURL(/\/checkout\?payment=failure$/)
    await expect(page.getByRole('alert')).toContainText('購物車已保留')

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('收件人姓名').fill('王小美')
    await page.getByLabel('手機號碼').fill('0912345678')
    await page.getByLabel('取貨門市名稱').fill('台北門市')
    await page.getByLabel('門市店號').fill('123456')
    await page.getByRole('button', { name: '前往測試付款' }).click()
    await expect(page).toHaveURL(/\/checkout\/payment\/[0-9a-f-]+$/)
    const attemptId = page.url().split('/').at(-1)
    expect(attemptId).toBeTruthy()
    const orderCountBefore = await countOrdersForEmail(email)
    const stockBefore = await getVariantStock(variantId ?? '')

    await page.getByRole('button', { name: '模擬付款成功' }).click()

    await expect(page).toHaveURL(/\/order-complete\/MORI-/)
    await expect(page.getByRole('heading', { name: '訂單完成' })).toBeVisible()
    await expect(page.getByText('付款成功')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('mori-cart-v1')))
      .toBe('[]')

    const orderNumber = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1) ?? '')
    const replayResponse = await page.request.post('/api/test-payment', {
      headers: { origin: new URL(page.url()).origin },
      data: { attemptId, outcome: 'success' },
    })
    expect(replayResponse.ok()).toBe(true)
    await expect(replayResponse.json()).resolves.toMatchObject({
      outcome: 'success',
      orderNumber,
    })

    const orderCountAfter = await countOrdersForEmail(email)
    const stockAfter = await getVariantStock(variantId ?? '')
    expect(orderCountAfter).toBe(orderCountBefore + 1)
    expect(stockAfter).toBe(stockBefore - 1)
  })
})
