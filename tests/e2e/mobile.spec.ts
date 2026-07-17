import { expect, test, type Page } from '@playwright/test'

const liveBaseUrl = process.env.E2E_BASE_URL

async function expectNoHorizontalOverflow(page: Page, path: string) {
  const response = await page.goto(path)
  expect(response?.ok(), `${path} must return a successful response`).toBe(true)
  await expect(page.locator('body')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(375)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375)
}

for (const { name, path } of [
  { name: 'homepage', path: '/' },
  { name: 'product', path: '/products/mori-organic-cotton-tee' },
  { name: 'cart', path: '/cart' },
  { name: 'checkout', path: '/checkout' },
]) {
  test(`${name} fits the 375 px viewport`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile',
      '375 px overflow acceptance runs in the mobile project',
    )
    test.skip(
      (name === 'product' || name === 'cart') && !liveBaseUrl,
      'requires E2E_BASE_URL and a seeded Supabase project',
    )
    await expectNoHorizontalOverflow(page, path)
  })
}
