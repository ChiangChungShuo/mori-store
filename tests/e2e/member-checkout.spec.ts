import { expect, test } from '@playwright/test'

const hasLiveData = process.env.HAS_LIVE_DATA === '1'
const email = process.env.E2E_CUSTOMER_EMAIL
const password = process.env.E2E_CUSTOMER_PASSWORD
const variantId = process.env.E2E_MEMBER_VARIANT_ID

test.describe('member checkout and order history', () => {
  test.skip(
    !hasLiveData || !email || !password || !variantId,
    'requires HAS_LIVE_DATA=1, customer credentials and E2E_MEMBER_VARIANT_ID',
  )

  test('records a signed-in checkout in the member order history', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email ?? '')
    await page.getByLabel('密碼').fill(password ?? '')
    await page.getByRole('button', { name: '登入' }).click()
    await expect(page).toHaveURL(/\/account(?:\/|$)/)

    await page.evaluate((id) => {
      window.localStorage.setItem('mori-cart-v1', JSON.stringify([{
        variantId: id,
        productSlug: 'mori-organic-cotton-tee',
        name: '有機棉小樹 T 恤',
        imageUrl: null,
        color: '鼠尾草綠',
        size: '100',
        unitPrice: 1,
        quantity: 1,
        maxStock: 5,
      }]))
    }, variantId)

    await page.goto('/checkout')
    await page.getByLabel('Email').fill(email ?? '')
    await page.getByLabel('收件人姓名').fill('王小美')
    await page.getByLabel('手機號碼').fill('0912345678')
    await page.getByRole('radio', { name: '7-ELEVEN', exact: true }).check()
    await page.getByLabel('取貨門市名稱').fill('台北門市')
    await page.getByLabel('門市店號').fill('123456')
    await page.getByRole('button', { name: '前往測試付款' }).click()
    await page.getByRole('button', { name: '模擬付款成功' }).click()

    await expect(page).toHaveURL(/\/order-complete\/MORI-/)
    const orderNumber = (await page.url()).match(/order-complete\/([^?]+)/)?.[1]
    expect(orderNumber).toBeTruthy()

    await page.goto('/account/orders')
    await expect(page.getByRole('heading', { name: orderNumber ?? '' })).toBeVisible()
  })
})
