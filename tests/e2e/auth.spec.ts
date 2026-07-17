import { expect, test } from '@playwright/test'

const baseUrl = process.env.E2E_BASE_URL
const email = process.env.E2E_CUSTOMER_EMAIL
const password = process.env.E2E_CUSTOMER_PASSWORD

test.describe('email/password authentication', () => {
  test.skip(!baseUrl || !email || !password, 'requires E2E_BASE_URL and customer credentials')

  test('customer can sign in with email and password', async ({ page }) => {
    await page.goto(`${baseUrl}/login`)
    await page.getByLabel('Email').fill(email ?? '')
    await page.getByLabel('密碼').fill(password ?? '')
    await page.getByRole('button', { name: '登入' }).click()

    await expect(page).toHaveURL(new RegExp(`${baseUrl}/account`))
  })
})
