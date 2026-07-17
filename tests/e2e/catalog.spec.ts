import { expect, test } from '@playwright/test'

const hasLiveData = process.env.HAS_LIVE_DATA === '1'

test.describe('product catalog filters', () => {
  test.skip(!hasLiveData, 'requires HAS_LIVE_DATA=1 and a seeded Supabase project')

  test('keeps filters in URL history for back and forward navigation', async ({ page }) => {
    await page.goto('/products')
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
