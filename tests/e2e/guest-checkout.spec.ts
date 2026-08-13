import { expect, test } from '@playwright/test'

test('requires a member session before checkout', async ({ page }) => {
  await page.goto('/checkout')

  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout$/)
  await expect(page.getByRole('heading', { name: '歡迎回到 MORIMUR BABY' })).toBeVisible()
})
