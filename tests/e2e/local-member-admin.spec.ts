import { expect, test } from '@playwright/test'

test('customer is denied while owner can manage the seeded order on mobile', async ({ page, context }, testInfo) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'local fixture flow only')
  const email = `admin-access-${testInfo.project.name}-${Date.now()}@example.com`

  await page.goto('/signup')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('密碼', { exact: true }).fill('parent123')
  await page.getByRole('button', { name: '建立會員帳號' }).click()
  await page.getByRole('link', { name: '前往登入' }).click()
  await page.waitForURL('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('密碼', { exact: true }).fill('parent123')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL('/account')

  await page.goto('/admin')
  await expect(page).toHaveURL('/403')

  await context.clearCookies()
  await page.goto('/login?next=%2Fadmin')
  await page.getByLabel('Email').fill('admin@mori.tw')
  await page.getByLabel('密碼', { exact: true }).fill('mori123456')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL('/admin')
  const ownerNavigation = page.getByRole('navigation', { name: '商店後台導覽' })
  for (const name of ['商店總覽', '訂單管理', '商品管理', '返回商城']) {
    await expect(ownerNavigation.getByRole('link', { name })).toBeVisible()
  }

  await page.getByRole('link', { name: '訂單管理' }).click()
  await page.getByLabel('訂單編號、收件人或 Email').fill('王小美')
  await page.getByLabel('狀態').selectOption('paid')
  await page.getByRole('button', { name: '篩選' }).click()
  await expect(page.getByText('王小美')).toBeVisible()
  await page.getByRole('link', { name: 'MORI-DEMO-1001' }).click()
  await expect(page.getByText('7-ELEVEN')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.getByRole('link', { name: '返回訂單列表' }).click()
  await page.getByLabel('訂單編號、收件人或 Email').fill('不存在的訂單')
  await page.getByRole('button', { name: '篩選' }).click()
  await expect(page.getByText('尚未有訂單，請先從商城完成一筆測試付款。')).toBeVisible()
  await expect(page.getByRole('link', { name: '前往商品列表' })).toHaveAttribute('href', '/products')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
