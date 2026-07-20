import { expect, test } from '@playwright/test'

test('completes the local fixture checkout without Supabase', async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'local fixture checkout only')

  await page.goto('/products/mori-organic-cotton-tee')
  await page.getByRole('button', { name: '尺寸 100' }).click()
  await page.getByRole('button', { name: '加入購物車' }).click()
  await page.goto('/checkout')

  await page.getByLabel('Email').fill('preview-parent@example.com')
  await page.getByLabel('收件人姓名').fill('王小美')
  await page.getByLabel('手機號碼').fill('0912345678')
  await page.getByLabel('取貨門市').selectOption('123456')
  await page.getByRole('button', { name: '前往測試付款' }).click()

  await expect(page).toHaveURL(/\/checkout\/payment\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: '測試付款' })).toBeVisible()
  await page.getByRole('button', { name: '模擬付款成功' }).click()

  await expect(page).toHaveURL(/\/order-complete\/MORI-DEMO-/)
  await expect(page.getByRole('heading', { name: '訂單完成' })).toBeVisible()
  await expect(page.getByText('付款成功')).toBeVisible()
  const orderNumber = new URL(page.url()).pathname.split('/').at(-1)!
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('mori-cart-v1')))
    .toBe('[]')

  await page.goto('/order-lookup')
  await page.getByLabel('訂單編號').fill(orderNumber)
  await page.getByLabel('Email').fill('preview-parent@example.com')
  await page.getByRole('button', { name: '查詢訂單' }).click()

  await expect(page.getByText(orderNumber)).toBeVisible()
  await expect(page.getByText('王小美（0912345678）')).toBeVisible()
})
