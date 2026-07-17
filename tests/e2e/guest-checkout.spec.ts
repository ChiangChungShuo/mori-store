import { expect, test } from '@playwright/test'

const hasLiveData = process.env.HAS_LIVE_DATA === '1'
const variantId = process.env.E2E_GUEST_VARIANT_ID

test.describe('guest checkout', () => {
  test.skip(!hasLiveData || !variantId, 'requires HAS_LIVE_DATA=1, E2E_GUEST_VARIANT_ID and a seeded Supabase project')

  test('keeps the cart after failure and clears it after an idempotent success', async ({ page }) => {
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
    await page.getByLabel('Email').fill('parent@example.com')
    await page.getByLabel('收件人姓名').fill('王小美')
    await page.getByLabel('手機號碼').fill('0912345678')
    await page.getByLabel('超商通路').selectOption('seven_eleven')
    await page.getByLabel('取貨門市').selectOption('123456')
    await page.getByRole('button', { name: '前往測試付款' }).click()

    await expect(page).toHaveURL(/\/checkout\/payment\/[0-9a-f-]+$/)
    await page.getByRole('button', { name: '模擬付款失敗' }).click()
    await expect(page).toHaveURL(/\/checkout\?payment=failure$/)
    await expect(page.getByRole('alert')).toContainText('購物袋已保留')

    await page.getByLabel('Email').fill('parent@example.com')
    await page.getByLabel('收件人姓名').fill('王小美')
    await page.getByLabel('手機號碼').fill('0912345678')
    await page.getByLabel('取貨門市').selectOption('123456')
    await page.getByRole('button', { name: '前往測試付款' }).click()
    await page.getByRole('button', { name: '模擬付款成功' }).click()

    await expect(page).toHaveURL(/\/order-complete\/MORI-/)
    await expect(page.getByRole('heading', { name: '訂單完成' })).toBeVisible()
    await expect(page.getByText('付款成功')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('mori-cart-v1')))
      .toBe('[]')
  })
})
