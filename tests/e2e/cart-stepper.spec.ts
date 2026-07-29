import { expect, test } from '@playwright/test'

test('quantity stepper border ends immediately after the plus button', async ({ page }) => {
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
      quantity: 3,
      maxStock: 12,
    }]))
  })
  await page.reload()
  const stepper = page.locator('.cart-page-list .quantity-stepper')
  await expect(stepper).toBeVisible()

  const hasNoTrailingSpace = await stepper.evaluate((element) => {
    const childrenWidth = [...element.children]
      .reduce((total, child) => total + child.getBoundingClientRect().width, 0)
    const borderWidth = Number.parseFloat(getComputedStyle(element).borderLeftWidth)
      + Number.parseFloat(getComputedStyle(element).borderRightWidth)
    return Math.abs(element.getBoundingClientRect().width - childrenWidth - borderWidth) < 1
  })
  expect(hasNoTrailingSpace).toBe(true)
})
