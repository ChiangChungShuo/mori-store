import { expect, test } from '@playwright/test'

test('registered customer pays and owner sees the same order', async ({ browser }, testInfo) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'local fixture flow only')
  const email = `parent-${testInfo.project.name}-${Date.now()}@example.com`
  const customer = await browser.newContext()
  const page = await customer.newPage()

  await page.goto('/signup')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('密碼', { exact: true }).fill('parent123')
  await page.getByRole('button', { name: '建立會員帳號' }).click()
  await expect(page.getByText('註冊成功，現在可以使用相同帳密登入。')).toBeVisible()

  await page.getByRole('link', { name: '前往登入' }).click()
  await page.waitForURL('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('密碼', { exact: true }).fill('parent123')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL('/account')

  await page.goto('/products/mori-organic-cotton-tee')
  await page.getByRole('button', { name: '尺寸 100' }).click()
  await page.getByRole('button', { name: '加入購物車' }).click()
  await page.goto('/cart')
  await page.getByRole('button', { name: '增加 有機棉小樹 T 恤 數量' }).click()
  await expect(page.getByRole('status', { name: '有機棉小樹 T 恤 數量' })).toHaveText('2')
  await page.getByRole('link', { name: '前往結帳' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('收件人姓名').fill('王小美')
  await page.getByLabel('手機號碼').fill('0912345678')
  await page.getByLabel('取貨門市').selectOption('123456')
  await page.getByRole('button', { name: '前往測試付款' }).click()
  await page.getByRole('button', { name: '模擬付款成功' }).click()
  await expect(page).toHaveURL(/\/order-complete\/MORI-DEMO-/)
  await expect(page.getByRole('heading', { name: '訂單完成' })).toBeVisible()
  const orderNumber = new URL(page.url()).pathname.split('/').at(-1)
  expect(orderNumber).toMatch(/^MORI-DEMO-/)

  await page.goto('/account/orders')
  await expect(page.getByRole('link', { name: orderNumber! })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const owner = await browser.newContext()
  const ownerPage = await owner.newPage()
  await ownerPage.goto('/login?next=/admin')
  await ownerPage.getByLabel('Email').fill('admin@mori.tw')
  await ownerPage.getByLabel('密碼', { exact: true }).fill('mori123456')
  await ownerPage.getByRole('button', { name: '登入' }).click()
  await expect(ownerPage).toHaveURL('/admin')
  await ownerPage.getByRole('link', { name: '管理訂單' }).click()
  await expect(ownerPage.getByRole('link', { name: orderNumber! })).toBeVisible()
  await ownerPage.getByRole('link', { name: orderNumber! }).click()
  await expect(ownerPage).toHaveURL(new RegExp(`/admin/orders/${orderNumber}$`))
  await expect(ownerPage.getByText('王小美', { exact: true }).first()).toBeVisible()
  await expect(ownerPage.getByText('7-ELEVEN')).toBeVisible()
  await expect(ownerPage.getByText('已付款', { exact: true })).toBeVisible()
  expect(await ownerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await customer.close()
  await owner.close()
})

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
  const seededOrder = page.getByRole('row').filter({
    has: page.getByRole('link', { name: 'MORI-DEMO-1001' }),
  })
  await expect(seededOrder.getByRole('cell', { name: /王小美/ })).toBeVisible()
  await seededOrder.getByRole('link', { name: 'MORI-DEMO-1001' }).click()
  await expect(page.getByText('7-ELEVEN')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.getByRole('link', { name: '返回訂單列表' }).click()
  await page.getByLabel('訂單編號、收件人或 Email').fill('不存在的訂單')
  await page.getByRole('button', { name: '篩選' }).click()
  await expect(page.getByText('尚未有訂單，請先從商城完成一筆測試付款。')).toBeVisible()
  await expect(page.getByRole('link', { name: '前往商品列表' })).toHaveAttribute('href', '/products')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
