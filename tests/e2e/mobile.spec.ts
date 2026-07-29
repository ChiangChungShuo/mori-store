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
  await page.goto('/cart')
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
  const title = () => page.locator('.hero-carousel h1').textContent()
    .then((value) => value?.replace(/\s+/g, ' ').trim())
  const firstTitle = await title()
  await page.locator('.hero-carousel').dispatchEvent('pointerdown', { clientX: 330 })
  await page.locator('.hero-carousel').dispatchEvent('pointerup', { clientX: 80 })
  await expect.poll(title).not.toBe(firstTitle)
  await page.getByRole('button', { name: '上一張輪播圖片' }).click()
  await expect.poll(title).toBe(firstTitle)
  expect(await page.locator('.product-grid .product-card').count()).toBeGreaterThan(0)
  await expect(page.getByRole('heading', { name: '有機棉小樹 T 恤' })).toBeVisible()
  const footerLogo = page.locator('.footer-brand-lockup .brand')
  const footerCopy = page.locator('.footer-brand-copy')
  await expect(footerLogo).toHaveCSS('width', '60px')
  const footerLogoBox = await footerLogo.boundingBox()
  const footerCopyBox = await footerCopy.boundingBox()
  expect(footerLogoBox).not.toBeNull()
  expect(footerCopyBox).not.toBeNull()
  expect(footerLogoBox!.x + footerLogoBox!.width).toBeLessThanOrEqual(footerCopyBox!.x)
})

test('opens and closes the storefront navigation at 375 px', async ({ page }) => {
  await page.goto('/')
  const openTrigger = page.getByRole('button', { name: '開啟選單' })
  const trigger = page.locator('.store-mobile-left > .mobile-menu .mobile-menu-trigger')
  const searchTrigger = page.getByRole('button', { name: '開啟商品搜尋' })
  const accountLink = page.locator('.mobile-account-link')
  await expect(openTrigger).toBeVisible()
  await expect(searchTrigger).toBeVisible()
  await expect(accountLink).toHaveAttribute('href', '/login?next=/account')
  const brand = page.getByRole('link', { name: 'MORIMUR BABY 首頁', exact: true })
  const cartTrigger = page.locator('.cart-drawer > summary')
  await expect(brand).toHaveCSS('width', '52px')
  await expect(cartTrigger).toBeVisible()
  const leftGroup = page.locator('.store-mobile-left')
  const rightGroup = page.locator('.store-mobile-right')
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
  expect(Math.abs(brandBox!.x + brandBox!.width / 2 - 187.5)).toBeLessThan(1)
  expect(await leftGroup.evaluate((node) => node.getBoundingClientRect().width))
    .toBe(await rightGroup.evaluate((node) => node.getBoundingClientRect().width))

  await searchTrigger.click()
  const searchbox = page.getByRole('searchbox', { name: '搜尋商品' })
  await expect(searchbox).toBeFocused()
  await searchbox.fill('小樹')
  await page.getByRole('button', { name: '開始搜尋' }).click()
  await expect(page).toHaveURL(/\/products\?q=%E5%B0%8F%E6%A8%B9/)
  await page.goto('/')

  await openTrigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  const dialog = page.getByRole('dialog', { name: '主要導覽' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('data-side', 'left')
  await expect.poll(async () => Math.round((await dialog.locator('.mobile-menu-panel').boundingBox())?.x ?? -999)).toBe(0)
  await expect.poll(async () => Math.round((await dialog.locator('.mobile-menu-panel').boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(320)
  await expect(dialog.getByRole('link', { name: '所有商品' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '商品導覽' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '搜尋' })).toHaveCount(0)
  await expect(dialog.getByRole('heading', { name: '會員服務' })).toHaveCount(0)
  const categories = dialog.locator('.store-mobile-categories')
  await expect(categories).not.toHaveAttribute('open', '')
  await categories.locator('summary').click()
  await expect(categories).toHaveAttribute('open', '')
  await expect(categories.getByRole('link', { name: '上衣', exact: true })).toBeVisible()
  await expect(dialog.getByRole('link', { name: '訪客查單' })).toBeVisible()
  // The admin backend link is only shown to admin accounts, never to guests.
  await expect(dialog.getByRole('link', { name: '老闆後台' })).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(trigger.locator('i').first()).toHaveCSS('transition-duration', '0s')
  await expect(dialog.locator('.mobile-menu-panel')).toHaveCSS('animation-duration', '0s')
  await page.setViewportSize({ width: 577, height: 812 })
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(dialog).not.toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await dialog.getByRole('link', { name: '品牌故事' }).click()
  await expect(dialog).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375)

  await cartTrigger.click()
  const cartPanel = page.locator('.cart-drawer-panel')
  await expect(cartPanel).toBeVisible()
  const cartPanelBox = await cartPanel.boundingBox()
  expect(cartPanelBox).not.toBeNull()
  expect(cartPanelBox!.y).toBeGreaterThanOrEqual(0)
  expect(cartPanelBox!.y + cartPanelBox!.height).toBeLessThanOrEqual(812)
})

test('populated product detail fits the 375 px viewport', async ({ page }) => {
  await expectNoHorizontalOverflow(page, '/products/mori-organic-cotton-tee')
  await expect(page.getByRole('heading', { name: '有機棉小樹 T 恤' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^尺寸 / })).toHaveCount(2)
})

test('populated cart fits the 375 px viewport', async ({ page }) => {
  test.skip(externalTarget && !process.env.E2E_GUEST_VARIANT_ID, 'live cart requires E2E_GUEST_VARIANT_ID')
  await page.goto('/')
  await page.waitForFunction(() => window.localStorage.getItem('mori-cart-v1') !== null)
  await page.evaluate((cart) => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify(cart))
  }, fixtureCart.map((item) => ({ ...item, quantity: 1 })))
  const response = await page.goto('/cart')
  expect(response?.ok(), '/cart must return a successful response').toBe(true)
  await expect(page.locator('.cart-page-list li')).toHaveCount(1)
  await page.getByRole('button', { name: '增加 有機棉小樹 T 恤 數量' }).click()
  await expect(page.getByRole('status', { name: '有機棉小樹 T 恤 數量' })).toHaveText('2')
  const stepperHasEqualCells = await page.locator('.cart-page-list .quantity-stepper').evaluate((stepper) => {
    const widths = [...stepper.children].map((child) => child.getBoundingClientRect().width)
    return Math.max(...widths) - Math.min(...widths) < 1
  })
  expect(stepperHasEqualCells).toBe(true)
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(375)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375)
})

test('populated checkout fits the 375 px viewport', async ({ page }) => {
  test.skip(externalTarget, 'checkout viewport requires a configured member account')
  await page.goto('/login')
  await page.getByLabel('Email 或手機號碼').fill('admin@mori.tw')
  await page.getByLabel('密碼', { exact: true }).fill('mori123456')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL('/admin')
  await seedCart(page)
  await expectNoHorizontalOverflow(page, '/checkout')
  await page.getByLabel('Email').fill('parent@example.com')
  await page.getByLabel('收件人姓名').fill('王小美')
  await page.getByLabel('手機號碼').fill('0912345678')
  await page.getByLabel('取貨門市名稱').fill('台北門市')
  await page.getByLabel('門市店號').fill('123456')
  await expect(page.locator('.cart-drawer summary')).toContainText('購物車2')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375)
})
