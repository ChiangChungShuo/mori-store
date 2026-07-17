import { expect, test } from '@playwright/test'

const baseUrl = process.env.E2E_BASE_URL

test.describe('product catalog filters', () => {
  test.skip(!baseUrl, 'requires a running storefront through E2E_BASE_URL')

  test('keeps filters in URL history for back and forward navigation', async ({ page }) => {
    await page.goto(`${baseUrl ?? ''}/products`)
    await page.getByLabel('年齡').selectOption('6-9')
    await page.getByRole('button', { name: '套用篩選' }).click()
    await expect(page).toHaveURL(/\/products\?age=6-9/)
    await expect(page.getByLabel('年齡')).toHaveValue('6-9')

    await page.goBack()
    await expect(page.getByLabel('年齡')).toHaveValue('')
    await page.goForward()
    await expect(page.getByLabel('年齡')).toHaveValue('6-9')
  })
})
