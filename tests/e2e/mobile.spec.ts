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

async function seedCart(page: Page, quantity = fixtureCart[0].quantity) {
  await page.goto('/checkout')
  await expect(page.getByRole('alert').filter({ hasText: '購物車沒有可結帳的商品' }))
    .toBeVisible()
  await page.evaluate((cart) => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify(cart))
  }, fixtureCart.map((item) => ({ ...item, quantity })))
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

test('opens and closes the storefront navigation at 375 px', async ({ page }) => {
  await page.goto('/')
  const openTrigger = page.getByRole('button', { name: '開啟選單' })
  const trigger = page.locator('.site-nav > .mobile-menu .mobile-menu-trigger')
  await expect(openTrigger).toBeVisible()
  const brand = page.getByRole('link', { name: 'mori', exact: true })
  const cartTrigger = page.locator('.cart-drawer > summary')
  await expect(brand).toHaveCSS('width', '52px')
  await expect(cartTrigger).toBeVisible()
  const triggerBox = await trigger.boundingBox()
  const brandBox = await brand.boundingBox()
  const cartBox = await cartTrigger.boundingBox()
  expect(triggerBox).not.toBeNull()
  expect(brandBox).not.toBeNull()
  expect(cartBox).not.toBeNull()
  expect(triggerBox!.x).toBeLessThan(brandBox!.x)
  expect(cartBox!.x).toBeGreaterThan(brandBox!.x + brandBox!.width)
  expect(Math.abs((triggerBox!.y + triggerBox!.height / 2) - (cartBox!.y + cartBox!.height / 2)))
    .toBeLessThan(20)
  await openTrigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  const dialog = page.getByRole('dialog', { name: '主要導覽' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('link', { name: '所有商品' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '商品導覽' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '搜尋' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '會員服務' })).toBeVisible()
  await expect(dialog.getByRole('link', { name: '收藏清單' })).toBeVisible()
  await expect(dialog.getByRole('link', { name: '訪客查單' })).toBeVisible()
  await expect(dialog.getByRole('link', { name: '老闆後台' })).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(trigger.locator('i').first()).toHaveCSS('transition-duration', '0s')
  await expect(dialog.locator('.mobile-menu-panel')).toHaveCSS('animation-duration', '0s')
  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await dialog.getByRole('link', { name: '品牌故事' }).click()
  await expect(dialog).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375)
})

test('populated product detail fits the 375 px viewport', async ({ page }) => {
  await expectNoHorizontalOverflow(page, '/products/mori-organic-cotton-tee')
  await expect(page.getByRole('heading', { name: '有機棉小樹 T 恤' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^尺寸 / })).toHaveCount(2)
})

test('populated cart fits the 375 px viewport', async ({ page }) => {
  test.skip(externalTarget && !process.env.E2E_GUEST_VARIANT_ID, 'live cart requires E2E_GUEST_VARIANT_ID')
  await page.goto('/cart')
  await page.evaluate((cart) => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify(cart))
  }, fixtureCart.map((item) => ({ ...item, quantity: 1 })))
  const response = await page.reload()
  expect(response?.ok(), '/cart must return a successful response').toBe(true)
  await expect(page.locator('.cart-page-list li')).toHaveCount(1)
  await page.getByRole('button', { name: '增加 有機棉小樹 T 恤 數量' }).click()
  await expect(page.getByRole('status', { name: '有機棉小樹 T 恤 數量' })).toHaveText('2')
  const stepperHasEqualCells = await page.locator('.quantity-stepper').evaluate((stepper) => {
    const widths = [...stepper.children].map((child) => child.getBoundingClientRect().width)
    return Math.max(...widths) - Math.min(...widths) < 1
  })
  expect(stepperHasEqualCells).toBe(true)
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
  await expect(page.locator('.cart-drawer summary')).toContainText('購物車2')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375)
})
