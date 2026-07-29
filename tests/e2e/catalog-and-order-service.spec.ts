import { expect, test } from '@playwright/test'

test('catalog search includes variant colors and the category menu filters products', async ({ page }) => {
  await page.goto('/products?q=%E8%97%8D')

  await expect(page.getByRole('heading', { name: '自在長褲' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '水洗丹寧吊帶褲' })).toBeVisible()

  const categoryMenu = page.locator('.nav-category-menu')
  await categoryMenu.locator('summary').click()
  await categoryMenu.getByRole('link', { name: '洋裝', exact: true }).click()
  await expect(page).toHaveURL(/\/products\?category=%E6%B4%8B%E8%A3%9D$/)
  await expect(page.getByRole('heading', { name: '花野洋裝' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '自在長褲' })).toHaveCount(0)
})

test('owner reply is visible in guest order lookup', async ({ page, context }) => {
  await page.goto('/login?next=/admin/orders/MORI-DEMO-1001')
  await page.getByLabel('Email').fill('admin@mori.tw')
  await page.getByLabel('密碼', { exact: true }).fill('mori123456')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL('/admin')
  await page.goto('/admin/orders/MORI-DEMO-1001')

  await page.getByLabel('回覆客戶').fill('尺寸已確認，今天會安排備貨。')
  await page.getByRole('button', { name: '儲存回覆' }).click()
  await expect(page.getByText('回覆已儲存，顧客可在訂單內容中查看')).toBeVisible()

  await context.clearCookies()
  await page.goto('/order-lookup')
  await page.getByLabel('訂單編號').fill('MORI-DEMO-1001')
  await page.getByLabel('Email', { exact: true }).fill('parent@example.com')
  await page.getByRole('button', { name: '查詢訂單' }).click()
  await expect(page.getByText('mori 客服回覆')).toBeVisible()
  await expect(page.getByText('尺寸已確認，今天會安排備貨。')).toBeVisible()
})

test('owner-created category appears in storefront navigation and product editor', async ({ page }) => {
  const categoryName = `親子配件${Date.now()}`
  await page.goto('/login?next=/admin/categories')
  await page.getByLabel('Email').fill('admin@mori.tw')
  await page.getByLabel('密碼', { exact: true }).fill('mori123456')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL('/admin')
  await page.goto('/admin/categories')

  await expect(page.getByRole('heading', { level: 1, name: '商品分類' })).toBeVisible()

  await page.getByLabel('新增分類').fill(categoryName)
  await page.getByRole('button', { name: '新增分類' }).click()
  await expect(page.getByText(`分類「${categoryName}」已新增`)).toBeVisible()

  await page.goto('/products')
  const menu = page.locator('.nav-category-menu')
  await menu.locator('summary').click()
  await expect(menu.getByRole('link', { name: categoryName })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '商品分類' }).getByRole('link', { name: categoryName })).toBeVisible()

  await page.goto('/admin/products/new')
  const category = page.getByLabel('分類')
  await expect(category.getByRole('option', { name: categoryName })).toHaveCount(1)
  await expect(page.getByRole('link', { name: '管理分類' })).toHaveAttribute('href', '/admin/categories')
  const beforeFocus = await category.boundingBox()
  await category.focus()
  expect(await category.boundingBox()).toEqual(beforeFocus)
})
