import { expect, test } from '@playwright/test'

test('lets a guest reach checkout from the cart without logging in', async ({ page }) => {
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

  const toCheckout = page.getByRole('link', { name: '前往結帳' })
  await expect(toCheckout).toHaveAttribute('href', '/checkout')
  await toCheckout.click()

  // Guest lands on the checkout form directly — no redirect to /login.
  await expect(page).toHaveURL('/checkout')
  await expect(page.getByRole('heading', { name: '填寫資料' })).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await expect(page.getByLabel('收件人姓名')).toBeVisible()
  await expect(page.getByLabel('手機號碼')).toBeVisible()
})
