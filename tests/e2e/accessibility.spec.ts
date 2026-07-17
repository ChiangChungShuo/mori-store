import { expect, test, type Locator, type Page } from '@playwright/test'

const liveBaseUrl = process.env.E2E_BASE_URL
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
}

test('tabs through the header with visible focus', async ({ page }) => {
  await page.goto('/checkout')

  const brand = page.getByRole('link', { name: 'mori', exact: true })
  await tabTo(page, brand)
  await expectVisibleFocus(brand)

  const newProducts = page.getByRole('link', { name: '新品', exact: true })
  await tabTo(page, newProducts)
  await expectVisibleFocus(newProducts)
})

test('tabs through seeded product controls with visible focus', async ({ page }) => {
  test.skip(!liveBaseUrl, 'requires E2E_BASE_URL and a seeded Supabase project')
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

test('tabs through checkout and connects every field error to its label', async ({ page }) => {
  await openCheckoutWithCart(page)

  const fields = [
    { label: 'Email', errorId: 'checkout-email-error', value: 'parent@example.com' },
    { label: '收件人姓名', errorId: 'checkout-recipient-name-error', value: '王小美' },
    { label: '手機號碼', errorId: 'checkout-phone-error', value: '0912345678' },
    { label: '超商通路', errorId: 'checkout-chain-error', value: 'seven_eleven' },
    { label: '取貨門市', errorId: 'checkout-store-error', value: '123456' },
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

  for (const { label, errorId } of fields) {
    const field = page.getByLabel(label)
    await field.evaluate((element: HTMLInputElement | HTMLSelectElement) => {
      element.setCustomValidity('請修正此欄位。')
    })
    await submit.click()

    await expect(field).toHaveAttribute('aria-describedby', errorId)
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator(`#${errorId}`)).toHaveAttribute('role', 'alert')

    await field.evaluate((element: HTMLInputElement | HTMLSelectElement) => {
      element.setCustomValidity('')
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })
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
