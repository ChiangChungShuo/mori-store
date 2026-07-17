import { expect, test } from '@playwright/test'

const baseUrl = process.env.E2E_BASE_URL
const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD
const paidOrderNumber = process.env.E2E_PAID_ORDER_NUMBER

test.describe('admin order fulfillment', () => {
  test.skip(
    !baseUrl || !email || !password || !paidOrderNumber,
    'requires E2E_BASE_URL, admin credentials and E2E_PAID_ORDER_NUMBER',
  )

  test('fulfills a paid order and blocks an invalid reverse transition', async ({ page }) => {
    await page.goto(`${baseUrl}/login?next=/admin/orders`)
    await page.getByLabel('Email').fill(email ?? '')
    await page.getByLabel('密碼').fill(password ?? '')
    await page.getByRole('button', { name: '登入' }).click()
    await expect(page).toHaveURL(`${baseUrl}/admin/orders`)

    await page.getByLabel('訂單編號、收件人或 Email').fill(paidOrderNumber ?? '')
    await page.getByRole('button', { name: '篩選' }).click()
    await expect(page).toHaveURL(`${baseUrl}/admin/orders`)
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
