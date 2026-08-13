import { expect, test } from '@playwright/test'

test('requires a guest to log in before checkout', async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'local fixture authentication only')

  await page.goto('/cart')
  await page.evaluate(() => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([{
      variantId: '00000000-0000-4000-8000-000000000001',
      productSlug: 'mori-organic-cotton-tee',
      name: '有機棉小樹 T 恤',
      imageUrl: null,
      color: '鼠尾草綠',
      size: '100',
      unitPrice: 680,
      quantity: 1,
      maxStock: 12,
    }]))
  })
  await page.reload()

  const toCheckout = page.getByRole('link', { name: '登入後結帳' })
  await expect(toCheckout).toHaveAttribute('href', '/login?next=%2Fcheckout')
  await toCheckout.click()

  await expect(page).toHaveURL('/login?next=%2Fcheckout')
  await expect(page.getByRole('heading', { name: '歡迎回到 MORIMUR BABY' })).toBeVisible()
})
