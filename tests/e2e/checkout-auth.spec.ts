import { expect, test } from '@playwright/test'

test('requires login before checkout and returns there after member sign-in', async ({ page, context }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'local fixture authentication only')
  const email = `checkout-member-${Date.now()}@example.com`
  const phone = `09${String(Date.now()).slice(-8)}`

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
  const loginToCheckout = page.getByRole('link', { name: '登入後結帳' })
  await expect(loginToCheckout).toHaveAttribute('href', '/login?next=%2Fcheckout')
  await loginToCheckout.click()
  await expect(page).toHaveURL('/login?next=%2Fcheckout')

  await page.goto('/signup')
  await page.getByLabel(/真實姓名/).fill('王小美')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('手機號碼').fill(phone)
  await page.getByLabel('設定密碼').fill('mori-parent-123')
  await page.getByLabel('確認密碼').fill('mori-parent-123')
  await page.getByLabel(/我已閱讀並同意/).check()
  await page.getByRole('button', { name: '寄送 Email 驗證碼' }).click()
  await page.getByLabel('Email 驗證碼').fill('123456')
  await page.getByRole('button', { name: '驗證並建立帳號' }).click()
  await expect(page).toHaveURL('/account')

  await context.clearCookies()

  await page.goto('/checkout')
  await expect(page).toHaveURL('/login?next=%2Fcheckout')
  await expect(page.getByRole('heading', { name: '歡迎回到 mori' })).toBeVisible()

  await page.getByLabel('Email 或手機號碼').fill(phone)
  await page.getByLabel('密碼', { exact: true }).fill('mori-parent-123')
  await page.getByRole('button', { name: '登入' }).click()

  await expect(page).toHaveURL('/checkout')
  await expect(page.getByRole('heading', { name: '填寫資料' })).toBeVisible()
})
