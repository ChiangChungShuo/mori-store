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
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) }
  })
  expect(outline.style).not.toBe('none')
  expect(outline.width).toBeGreaterThan(0)
}

async function openCheckoutWithCart(page: Page) {
  await page.goto('/checkout')
  await expect(page.getByRole('alert').filter({ hasText: '購物袋沒有可結帳的商品' }))
    .toBeVisible()
  await page.evaluate((cart) => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify(cart))
  }, checkoutCart)
  await page.reload()
  await expect(page.getByRole('heading', { name: '結帳' })).toBeVisible()
  await expect(page.locator('.cart-drawer summary')).toContainText('購物袋（1）')
  await expect(page.getByRole('button', { name: '前往測試付款' })).toBeEnabled()
}

test('tabs through the header with visible focus', async ({ page }) => {
  await page.goto('/checkout')

  const focusOrder = [
    page.getByRole('link', { name: 'mori', exact: true }),
    page.getByRole('link', { name: '新品', exact: true }),
    page.getByRole('link', { name: '依年齡', exact: true }),
    page.getByRole('link', { name: '品牌故事', exact: true }),
    page.getByRole('link', { name: '會員登入', exact: true }),
    page.getByRole('link', { name: '老闆後台', exact: true }),
    page.locator('.cart-drawer summary'),
  ]

  for (const target of focusOrder) {
    await page.keyboard.press('Tab')
    await expectVisibleFocus(target)
  }
})

test('keeps auth controls labeled, reachable and form-first on mobile', async ({ page }) => {
  for (const path of ['/login', '/signup']) {
    await page.goto(path)

    const form = page.locator('.auth-card')
    const story = page.locator('.auth-story')
    const email = page.getByLabel('Email')
    const password = page.getByLabel('密碼', { exact: true })
    const toggle = page.getByRole('button', { name: '顯示密碼' })

    await expect(email).toBeVisible()
    await expect(password).toHaveAttribute('type', 'password')
    await toggle.focus()
    await expectVisibleFocus(toggle)
    await expect(toggle).toHaveCSS('min-height', '44px')
    await toggle.click()
    await expect(password).toHaveAttribute('type', 'text')
    expect(await page.locator('.auth-shell').evaluate((shell) => (
      shell.firstElementChild?.classList.contains('auth-card')
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

  const addToCart = page.getByRole('button', { name: '加入購物袋' })
  await tabTo(page, addToCart)
  await expectVisibleFocus(addToCart)
})

test('tabs through checkout fields with programmatic labels', async ({ page }) => {
  await openCheckoutWithCart(page)

  const fields = [
    { label: 'Email', value: 'parent@example.com' },
    { label: '收件人姓名', value: '王小美' },
    { label: '手機號碼', value: '0912345678' },
    { label: '超商通路', value: 'seven_eleven' },
    { label: '取貨門市', value: '123456' },
  ]

  for (const { label, value } of fields) {
    const field = page.getByLabel(label)
    await tabTo(page, field)
    await expectVisibleFocus(field)
    expect(await field.evaluate((element: HTMLInputElement | HTMLSelectElement) => (
      element.labels?.length ?? 0
    ))).toBeGreaterThan(0)
    if (label === '超商通路' || label === '取貨門市') {
      await field.selectOption(value)
    } else {
      await field.fill(value)
    }
  }

  const submit = page.getByRole('button', { name: '前往測試付款' })
  await tabTo(page, submit)
  await expectVisibleFocus(submit)
})

test('connects real checkout validation errors to invalid fields', async ({ page }) => {
  await openCheckoutWithCart(page)

  const email = page.getByLabel('Email')
  const recipientName = page.getByLabel('收件人姓名')
  const phone = page.getByLabel('手機號碼')
  const store = page.getByLabel('取貨門市')
  const submit = page.getByRole('button', { name: '前往測試付款' })

  await expect(submit).toBeEnabled()
  await email.fill('not-an-email')
  await phone.fill('123')
  await submit.click()

  for (const field of [email, recipientName, phone, store]) {
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription(/.+/)
  }

  await email.fill('parent@example.com')
  await recipientName.fill('王小美')
  await phone.fill('0912345678')
  await store.selectOption('123456')

  for (const field of [email, recipientName, phone, store]) {
    await expect(field).toHaveAttribute('aria-invalid', 'false')
    await expect(field).not.toHaveAttribute('aria-describedby', /.+/)
  }
})

test('removes smooth scrolling and transitions for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openCheckoutWithCart(page)

  const styles = await page.getByRole('button', { name: '前往測試付款' }).evaluate((button) => ({
    animationDuration: window.getComputedStyle(button).animationDuration,
    scrollBehavior: window.getComputedStyle(document.documentElement).scrollBehavior,
    transitionDuration: window.getComputedStyle(button).transitionDuration,
  }))

  expect(styles.animationDuration).toBe('0s')
  expect(styles.scrollBehavior).toBe('auto')
  expect(styles.transitionDuration).toBe('0s')
})
