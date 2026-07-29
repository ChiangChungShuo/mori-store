import { expect, test } from '@playwright/test'

test('visitor can search from the header and share a product', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('search').getByPlaceholder('搜尋商品').fill('洋裝')
  await page.getByRole('button', { name: '開始搜尋' }).click()
  await expect(page).toHaveURL(/q=%E6%B4%8B%E8%A3%9D/)
  await expect(page.getByRole('heading', { name: '花野洋裝' })).toBeVisible()
  await expect(page.getByText('共 1 件商品')).toBeVisible()

  await page.getByRole('link', { name: '花野洋裝', exact: true }).click()
  const mainImage = await page.locator('.product-gallery-main').boundingBox()
  const thumbnail = await page.locator('.product-gallery-thumbnails button').count()
    ? await page.locator('.product-gallery-thumbnails button').first().boundingBox()
    : null
  expect(mainImage?.width).toBeGreaterThan(280)
  expect(mainImage?.height).toBeGreaterThan(350)
  if (thumbnail) expect(mainImage!.width).toBeGreaterThan(thumbnail.width * 3)
  await expect(page.getByText('目前庫存')).toHaveCount(0)
  await expect(page.getByText(/庫存 \d+ 件/)).toHaveCount(0)
  await expect(page.getByLabel('分享商品')).toBeVisible()
  await expect(page.getByRole('button', { name: '分享到 LINE' })).toBeVisible()
  await expect(page.getByRole('button', { name: '分享到 Facebook' })).toBeVisible()
  await expect(page.getByRole('button', { name: '分享到 X / Twitter' })).toBeVisible()
  const addToCart = await page.getByRole('button', { name: '加入購物車' }).boundingBox()
  const share = await page.getByLabel('分享商品').boundingBox()
  expect(share!.y).toBeGreaterThan(addToCart!.y)
  const serviceNote = await page.locator('.product-service-note').boundingBox()
  expect(serviceNote!.y).toBeGreaterThanOrEqual(share!.y + share!.height)

  await page.evaluate(() => window.scrollTo(0, 1200))
  await expect(page.locator('header#top')).toHaveCSS('position', 'sticky')
  expect((await page.locator('header#top').boundingBox())!.y).toBeLessThanOrEqual(1)
})

test('admin reports show purchase funnel, replenishment and search sections', async ({ page }) => {
  await page.goto('/login?next=/admin/reports')
  await page.getByLabel('Email').fill('admin@mori.tw')
  await page.getByRole('textbox', { name: '密碼' }).fill('mori123456')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await page.goto('/admin/reports')

  await expect(page.getByRole('heading', { name: '購買轉換漏斗' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '庫存補貨提醒' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '網站瀏覽量報表' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '網站搜尋成效' })).toBeVisible()
  await expect(page.getByText('近期瀏覽路徑')).toHaveCount(0)
})
