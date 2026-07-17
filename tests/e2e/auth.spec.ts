import { expect, test } from '@playwright/test'

const hasLiveData = process.env.HAS_LIVE_DATA === '1'
const email = process.env.E2E_CUSTOMER_EMAIL
const password = process.env.E2E_CUSTOMER_PASSWORD

test.describe('email/password authentication', () => {
  test.skip(!hasLiveData || !email || !password, 'requires HAS_LIVE_DATA=1 and customer credentials')

  test('customer can sign in with email and password', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email ?? '')
    await page.getByLabel('密碼').fill(password ?? '')
    await page.getByRole('button', { name: '登入' }).click()

    await expect(page).toHaveURL(/\/account(?:\/|$)/)
  })
})
