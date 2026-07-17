import { expect, test, type Page } from '@playwright/test'

const externalTarget = Boolean(process.env.E2E_BASE_URL)
const hasLiveData = process.env.HAS_LIVE_DATA === '1'
const fixtureVariantId = process.env.E2E_GUEST_VARIANT_ID
  ?? '00000000-0000-4000-8000-000000000001'
const fixtureCart = [{
  variantId: fixtureVariantId,
  productSlug: 'mori-organic-cotton-tee',
  name: '有機棉小樹 T 恤',
  imageUrl: null,
  color: '鼠尾草綠',
  size: '100',
  unitPrice: 680,
  quantity: 2,
  maxStock: 12,
}]

async function expectNoHorizontalOverflow(page: Page, path: string) {
  const response = await page.goto(path)
  expect(response?.ok(), `${path} must return a successful response`).toBe(true)
  await expect(page.locator('body')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(375)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375)
}

async function seedCart(page: Page) {
  await page.goto('/checkout')
  await expect(page.getByRole('alert').filter({ hasText: '購物袋沒有可結帳的商品' }))
    .toBeVisible()
  await page.evaluate((cart) => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify(cart))
  }, fixtureCart)
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile',
    '375 px overflow acceptance runs in the mobile project',
  )
  test.skip(externalTarget && !hasLiveData, 'external target requires HAS_LIVE_DATA=1')
})

test('populated homepage fits the 375 px viewport', async ({ page }) => {
  await expectNoHorizontalOverflow(page, '/')
  expect(await page.locator('.product-grid .product-card').count()).toBeGreaterThan(0)
  await expect(page.getByRole('heading', { name: '有機棉小樹 T 恤' })).toBeVisible()
})

test('populated product detail fits the 375 px viewport', async ({ page }) => {
  await expectNoHorizontalOverflow(page, '/products/mori-organic-cotton-tee')
  await expect(page.getByRole('heading', { name: '有機棉小樹 T 恤' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^尺寸 / })).toHaveCount(2)
})

test('populated cart fits the 375 px viewport', async ({ page }) => {
  test.skip(externalTarget && !process.env.E2E_GUEST_VARIANT_ID, 'live cart requires E2E_GUEST_VARIANT_ID')
  await seedCart(page)
  const response = await page.goto('/cart')
  expect(response?.ok(), '/cart must return a successful response').toBe(true)
  await expect(page.locator('.cart-page-list li')).toHaveCount(1)
  await expect(page.getByLabel('數量')).toHaveValue('2')
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(375)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375)
})

test('populated checkout fits the 375 px viewport', async ({ page }) => {
  await seedCart(page)
  await expectNoHorizontalOverflow(page, '/checkout')
  await page.getByLabel('Email').fill('parent@example.com')
  await page.getByLabel('收件人姓名').fill('王小美')
  await page.getByLabel('手機號碼').fill('0912345678')
  await page.getByLabel('取貨門市').selectOption('123456')
  await expect(page.locator('.cart-drawer summary')).toContainText('購物袋（2）')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375)
})
