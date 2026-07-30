import { expect, test, type Locator, type Page } from '@playwright/test'

const externalTarget = Boolean(process.env.E2E_BASE_URL)
const hasLiveData = process.env.HAS_LIVE_DATA === '1'
const checkoutCart = [{
  variantId: '00000000-0000-4000-8000-000000000001',
  productSlug: 'mori-organic-cotton-tee',
  name: '驗收商品',
  imageUrl: null,
  color: '鼠尾草綠',
  size: '100',
  unitPrice: 680,
  quantity: 1,
  maxStock: 5,
}]

async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible({ timeout: 5_000 })
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement)) return
  }
  throw new Error(`Tab did not reach ${await target.getAttribute('aria-label') ?? await target.textContent()}`)
}

async function expectVisibleFocus(target: Locator) {
  await expect(target).toBeFocused()
  const outline = await target.evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      boxShadow: style.boxShadow,
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    }
  })
  expect(
    (outline.style !== 'none' && outline.width > 0) || outline.boxShadow !== 'none',
  ).toBe(true)
}

async function openCheckoutWithCart(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email 或手機號碼').fill('admin@mori.tw')
  await page.getByLabel('密碼', { exact: true }).fill('mori123456')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL('/admin')
  await page.evaluate((cart) => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify(cart))
  }, checkoutCart)
  await page.goto('/checkout')
  await expect(page.getByRole('heading', { name: '填寫資料' })).toBeVisible()
  await expect(page.locator('.cart-drawer summary')).toContainText('購物車1')
  await expect(page.getByRole('button', { name: '請先完成訂單資料' })).toBeDisabled()
}

test('tabs through the desktop header with visible focus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop header navigation is hidden on mobile')
  await page.goto('/cart')

  await expect(page.getByRole('button', { name: '開啟選單' })).toBeHidden()
  await expect(page.getByRole('navigation', { name: '主要導覽' })
    .getByRole('link', { name: '新品', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'MORIMUR BABY 首頁', exact: true })).toHaveCSS('width', '76px')

  const focusOrder = [
    page.getByRole('link', { name: 'MORIMUR BABY 首頁', exact: true }),
    page.getByRole('link', { name: '新品', exact: true }),
    page.getByRole('link', { name: '所有商品', exact: true }).first(),
    page.getByRole('link', { name: '依年齡', exact: true }),
    page.locator('.nav-category-menu summary'),
    page.getByRole('link', { name: '品牌故事', exact: true }),
    page.locator('.account-menu summary'),
    page.getByRole('button', { name: '開啟商品搜尋' }),
    page.locator('.cart-drawer summary'),
  ]

  for (const target of focusOrder) {
    await tabTo(page, target)
    await expectVisibleFocus(target)
  }

  await page.getByRole('button', { name: '開啟商品搜尋' }).click()
  await expect(page.locator('.header-search input')).toBeFocused()
  await expectVisibleFocus(page.locator('.header-search input'))
})

test('keeps auth controls labeled, reachable and form-first on mobile', async ({ page }) => {
  await page.goto('/login')
  const password = page.getByLabel('密碼', { exact: true })
  const toggle = page.getByRole('button', { name: '顯示密碼' })
  await expect(page.getByLabel('Email 或手機號碼')).toBeVisible()
  await expect(password).toHaveAttribute('type', 'password')
  await tabTo(page, toggle)
  await expectVisibleFocus(toggle)
  await expect(toggle).toHaveCSS('min-height', '44px')
  await toggle.press('Space')
  await expect(password).toHaveAttribute('type', 'text')

  await page.goto('/signup')
  const nextButton = page.getByRole('button', { name: '寄送 Email 驗證碼' })
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('手機號碼')).toHaveAttribute('autocomplete', 'tel')
  await expect(page.getByLabel(/我已閱讀並同意/)).not.toBeChecked()
  await expect(nextButton).toBeDisabled()
  await page.getByLabel(/真實姓名/).fill('王小美')
  await page.getByLabel('Email').fill('accessible@example.com')
  await page.getByLabel('手機號碼').fill('0912345678')
  await page.getByLabel('設定密碼').fill('mori-parent-123')
  await page.getByLabel('確認密碼').fill('mori-parent-123')
  await page.getByLabel(/我已閱讀並同意/).check()
  await expect(nextButton).toBeEnabled()

  for (const path of ['/login', '/signup']) {
    await page.goto(path)
    const form = page.locator('.auth-card')
    const story = page.locator('.auth-story')
    expect(await page.locator('.auth-shell').evaluate((shell) => (
      shell.firstElementChild?.classList.contains('auth-card')
    ))).toBe(true)
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true)
    expect(await page.locator('.auth-shell').evaluate((shell) => (
      shell.scrollWidth <= shell.clientWidth
    ))).toBe(true)

    const formBox = await form.boundingBox()
    const storyBox = await story.boundingBox()
    expect(formBox).not.toBeNull()
    expect(storyBox).not.toBeNull()
    if (page.viewportSize()!.width <= 928) {
      expect(formBox!.y).toBeLessThan(storyBox!.y)
    } else {
      expect(storyBox!.x).toBeLessThan(formBox!.x)
    }
  }
})

test('tabs through seeded product controls with visible focus', async ({ page }) => {
  test.skip(externalTarget && !hasLiveData, 'external target requires HAS_LIVE_DATA=1')
  const response = await page.goto('/products/mori-organic-cotton-tee')
  expect(response?.ok(), 'seeded product route must return a successful response').toBe(true)
  const color = page.getByRole('button', { name: /^顏色 / }).first()
  const size = page.getByRole('button', { name: /^尺寸 / }).first()

  await tabTo(page, color)
  await expectVisibleFocus(color)
  await tabTo(page, size)
  await expectVisibleFocus(size)
  await size.press('Space')

  const addToCart = page.getByRole('button', { name: '加入購物車' })
  await tabTo(page, addToCart)
  await expectVisibleFocus(addToCart)
})

test('tabs through checkout fields with programmatic labels', async ({ page }) => {
  test.skip(externalTarget, 'checkout accessibility requires a configured member account')
  await openCheckoutWithCart(page)

  const fields = [
    { label: 'Email', value: 'parent@example.com' },
    { label: '收件人姓名', value: '王小美' },
    { label: '手機號碼', value: '0912345678' },
    { label: '取貨門市名稱', value: '台北門市' },
    { label: '門市店號', value: '123456' },
  ]

  for (const { label, value } of fields) {
    const field = page.getByLabel(label)
    await tabTo(page, field)
    await expectVisibleFocus(field)
    expect(await field.evaluate((element: HTMLInputElement | HTMLSelectElement) => (
      element.labels?.length ?? 0
    ))).toBeGreaterThan(0)
    await field.fill(value)
  }

  const chain = page.getByRole('radio', { name: '7-ELEVEN', exact: true })
  await expect(chain).toBeChecked()

  const submit = page.getByRole('button', { name: '送出資料，確認訂單' })
  await tabTo(page, submit)
  await expectVisibleFocus(submit)
})

test('connects real checkout validation errors to invalid fields', async ({ page }) => {
  test.skip(externalTarget, 'checkout accessibility requires a configured member account')
  await openCheckoutWithCart(page)

  const email = page.getByLabel('Email')
  const recipientName = page.getByLabel('收件人姓名')
  const phone = page.getByLabel('手機號碼')
  const storeName = page.getByLabel('取貨門市名稱')
  const storeId = page.getByLabel('門市店號')
  const form = page.locator('.checkout-form')

  await email.fill('not-an-email')
  await phone.fill('123')
  await form.evaluate((element: HTMLFormElement) => element.requestSubmit())

  for (const field of [email, recipientName, phone, storeName, storeId]) {
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription(/.+/)
  }

  await email.fill('parent@example.com')
  await recipientName.fill('王小美')
  await phone.fill('0912345678')
  await storeName.fill('台北門市')
  await storeId.fill('123456')

  for (const field of [email, recipientName, phone, storeName, storeId]) {
    await expect(field).toHaveAttribute('aria-invalid', 'false')
    await expect(field).not.toHaveAttribute('aria-describedby', /.+/)
  }
})

test('removes smooth scrolling and transitions for reduced motion', async ({ page }) => {
  test.skip(externalTarget, 'checkout accessibility requires a configured member account')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openCheckoutWithCart(page)

  const styles = await page.locator('.checkout-submit').evaluate((button) => ({
    animationDuration: window.getComputedStyle(button).animationDuration,
    scrollBehavior: window.getComputedStyle(document.documentElement).scrollBehavior,
    transitionDuration: window.getComputedStyle(button).transitionDuration,
  }))

  expect(styles.animationDuration).toBe('0s')
  expect(styles.scrollBehavior).toBe('auto')
  expect(styles.transitionDuration).toBe('0s')
})
