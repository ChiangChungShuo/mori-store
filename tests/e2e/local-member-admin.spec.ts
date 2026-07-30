import { expect, test } from '@playwright/test'

test('registered customer pays and owner sees the same order', async ({ browser }, testInfo) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'local fixture flow only')
  const email = `parent-${testInfo.project.name}-${Date.now()}@example.com`
  const customer = await browser.newContext()
  const page = await customer.newPage()

  await page.goto('/signup')
  await page.getByLabel(/真實姓名/).fill('王小美')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('手機號碼').fill('0912345678')
  await page.getByLabel('設定密碼').fill('mori-parent-123')
  await page.getByLabel('確認密碼').fill('mori-parent-123')
  await page.getByLabel(/我已閱讀並同意/).check()
  await page.getByRole('button', { name: '寄送 Email 驗證碼' }).click()
  await page.getByLabel('Email 驗證碼').fill('123456')
  await page.getByRole('button', { name: '驗證並建立帳號' }).click()
  await expect(page).toHaveURL('/account')

  await customer.clearCookies()
  await page.goto('/login')
  await page.getByLabel('Email 或手機號碼').fill('0912-345-678')
  await page.getByLabel('密碼', { exact: true }).fill('mori-parent-123')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL('/account')
  await page.goto('/')
  const mainNavigation = page.getByRole('navigation', { name: '主要導覽' })
  if (testInfo.project.name === 'mobile') {
    await expect(mainNavigation.getByRole('link', { name: '會員中心' })).toHaveAttribute('href', '/account')
  } else {
    await mainNavigation.getByLabel('會員選單').click()
    await expect(mainNavigation.getByRole('link', { name: '會員中心' })).toHaveAttribute('href', '/account')
    await expect(mainNavigation.getByRole('link', { name: '我的訂單' })).toHaveAttribute('href', '/account/orders')
  }

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
  await page.getByLabel('取貨門市名稱').fill('台北門市')
  await page.getByLabel('門市店號').fill('123456')
  await page.getByRole('button', { name: '送出資料，確認訂單' }).click()
  await expect(page.getByRole('heading', { name: '訂單確認' })).toBeVisible()
  await page.getByRole('button', { name: '確認資料並送出訂單' }).click()
  await page.getByRole('checkbox', { name: /我已確認/ }).check()
  await page.getByRole('button', { name: '確認送出訂單' }).click()
  await expect(page).toHaveURL(/\/order-complete\/MORI-DEMO-/)
  await expect(page.getByRole('heading', { name: '訂單完成' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '匯款資訊' })).toBeVisible()
  const orderNumber = new URL(page.url()).pathname.split('/').at(-1)
  expect(orderNumber).toMatch(/^MORI-DEMO-/)

  await page.goto('/account/orders')
  await expect(page.getByRole('link', { name: orderNumber! })).toBeVisible()
  await page.getByRole('link', { name: orderNumber! }).click()
  await page.getByLabel('帳號末 5 碼').fill('12345')
  await page.getByRole('button', { name: '送出末 5 碼' }).click()
  await expect(page.getByRole('status')).toContainText('末 5 碼已送出')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await customer.clearCookies()
  await page.goto('/order-lookup')
  await page.getByLabel('訂單編號').fill(orderNumber!)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: '查詢訂單' }).click()
  await expect(page.getByRole('heading', { name: orderNumber! })).toBeVisible()

  const owner = await browser.newContext()
  const ownerPage = await owner.newPage()
  await ownerPage.goto('/login?next=/admin')
  await ownerPage.getByLabel('Email 或手機號碼').fill('admin@mori.tw')
  await ownerPage.getByLabel('密碼', { exact: true }).fill('mori123456')
  await ownerPage.getByRole('button', { name: '登入' }).click()
  await expect(ownerPage).toHaveURL('/admin')
  await ownerPage.getByRole('link', { name: '管理訂單' }).click()
  await expect(ownerPage.getByRole('link', { name: orderNumber! })).toBeVisible()
  await ownerPage.getByRole('link', { name: orderNumber! }).click()
  await expect(ownerPage).toHaveURL(new RegExp(`/admin/orders/${orderNumber}$`))
  await expect(ownerPage.getByText('王小美', { exact: true }).first()).toBeVisible()
  await expect(ownerPage.getByText('7-ELEVEN')).toBeVisible()
  await expect(ownerPage.getByText('待付款', { exact: true })).toBeVisible()
  await expect(ownerPage.getByText('12345', { exact: true })).toBeVisible()
  const itemsSection = ownerPage.locator('section').filter({
    has: ownerPage.getByRole('heading', { name: '訂購商品' }),
  })
  const itemRow = itemsSection.getByRole('row', { name: /^有機棉小樹 T 恤 / })
  await expect(itemRow.getByRole('rowheader', { name: '有機棉小樹 T 恤' })).toBeVisible()
  await expect(itemRow.getByRole('cell', { name: '2', exact: true })).toBeVisible()
  for (const [label, amount] of [
    ['商品小計', 'NT$1,360'],
    ['運費', 'NT$60'],
    ['訂單總計', 'NT$1,420'],
  ]) {
    const totalRow = itemsSection.locator('dl.order-result > div').filter({ hasText: label })
    await expect(totalRow.locator('dt')).toHaveText(label)
    await expect(totalRow.locator('dd')).toHaveText(amount)
  }
  expect(await ownerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await ownerPage.goto('/admin/members')
  const registeredMember = ownerPage.locator('.admin-member-card').filter({ hasText: email })
  await expect(registeredMember).toContainText('0912345678')

  await customer.close()
  await owner.close()
})

test('customer is denied while owner can manage the seeded order on mobile', async ({ page, context }, testInfo) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'local fixture flow only')
  const email = `admin-access-${testInfo.project.name}-${Date.now()}@example.com`

  await page.goto('/signup')
  await page.getByLabel(/真實姓名/).fill('王小美')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('手機號碼').fill('0922345678')
  await page.getByLabel('設定密碼').fill('mori-parent-123')
  await page.getByLabel('確認密碼').fill('mori-parent-123')
  await page.getByLabel(/我已閱讀並同意/).check()
  await page.getByRole('button', { name: '寄送 Email 驗證碼' }).click()
  await page.getByLabel('Email 驗證碼').fill('123456')
  await page.getByRole('button', { name: '驗證並建立帳號' }).click()
  await expect(page).toHaveURL('/account')

  await page.goto('/admin')
  await expect(page).toHaveURL('/403')

  await context.clearCookies()
  await page.goto('/login?next=%2Fadmin')
  await page.getByLabel('Email 或手機號碼').fill('admin@mori.tw')
  await page.getByLabel('密碼', { exact: true }).fill('mori123456')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL('/admin')
  const trigger = page.getByRole('button', { name: '開啟選單' })
  if (testInfo.project.name === 'mobile') {
    await expect(trigger).toBeVisible()
    await trigger.click()
    const menu = page.getByRole('dialog', { name: '商店後台導覽' })
    await expect(menu).toHaveAttribute('data-side', 'left')
    await expect.poll(async () => Math.round((await menu.locator('.mobile-menu-panel').boundingBox())?.x ?? -999)).toBe(0)
    for (const name of ['商店總覽', '訂單管理', '商品管理與庫存', '商品分類', '會員管理', '行銷推廣', '報表分析', '商店設定', '返回商城']) {
      await expect(menu.getByRole('link', { name, exact: true })).toBeVisible()
    }
    await expect(menu.getByText('mori 老闆', { exact: true })).toBeVisible()
    await expect(menu.getByRole('button', { name: '登出' })).toBeVisible()
    const closeButton = menu.getByRole('button', { name: '關閉選單' })
    await expect(closeButton.evaluate((button) => {
      const box = button.getBoundingClientRect()
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === button
    })).resolves.toBe(true)
    const closeBox = await closeButton.boundingBox()
    expect(closeBox).not.toBeNull()
    await page.mouse.click(closeBox!.x + closeBox!.width / 2, closeBox!.y + closeBox!.height / 2)
    await expect(trigger).toBeFocused()
    const mobileBrand = page.locator('.admin-mobile-brand')
    const ownerHome = page.getByRole('link', { name: '商店後台首頁' })
    await expect(mobileBrand).toHaveCSS('width', '52px')
    await expect(ownerHome).toBeVisible()
    const triggerBox = await trigger.boundingBox()
    const brandBox = await mobileBrand.boundingBox()
    const ownerBox = await ownerHome.boundingBox()
    expect(triggerBox).not.toBeNull()
    expect(brandBox).not.toBeNull()
    expect(ownerBox).not.toBeNull()
    expect(triggerBox!.x).toBeLessThan(brandBox!.x)
    expect(ownerBox!.x).toBeGreaterThan(brandBox!.x + brandBox!.width)
    expect(Math.abs(brandBox!.x + brandBox!.width / 2 - 187.5)).toBeLessThan(1)
    const pipeline = page.locator('.order-pipeline')
    await expect(pipeline.locator(':scope > div')).toHaveCount(5)
    for (const status of ['待付款', '已付款', '備貨中', '已出貨', '已完成']) {
      await expect(pipeline.getByText(status, { exact: true })).toBeVisible()
    }
    expect(await pipeline.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean))).toHaveLength(2)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  } else {
    await expect(page.locator('.admin-sidebar')).toBeVisible()
    await expect(page.locator('.admin-brand')).toHaveCSS('width', '72px')
    await expect(trigger).toBeHidden()
    const ownerNavigation = page.getByRole('navigation', { name: '商店後台導覽' })
    for (const name of ['商店總覽', '訂單管理', '商品管理與庫存', '返回商城']) {
      await expect(ownerNavigation.getByRole('link', { name, exact: true })).toBeVisible()
    }
    await expect(page.locator('.admin-sidebar')).toHaveCSS('position', 'fixed')

    await page.setViewportSize({ width: 768, height: 900 })
    await expect(page.locator('.admin-mobile-header')).toBeHidden()
    await expect(page.locator('.admin-sidebar')).toHaveCSS('position', 'static')
    await expect(page.locator('.admin-sidebar')).toHaveCSS('width', '768px')
    await expect(page.locator('.admin-workspace')).toHaveCSS('margin-left', '0px')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768)
  }

  if (testInfo.project.name === 'mobile') {
    await trigger.click()
    const menu = page.getByRole('dialog', { name: '商店後台導覽' })
    await menu.getByRole('link', { name: '訂單管理', exact: true }).click()
    await expect(menu).toBeHidden()
  } else {
    await page.getByRole('navigation', { name: '商店後台導覽' }).getByRole('link', { name: '訂單管理', exact: true }).click()
  }
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
  await expect(page.getByText('尚未有訂單，可先從商城送出一筆示範訂單。')).toBeVisible()
  await expect(page.getByRole('link', { name: '前往商品列表' })).toHaveAttribute('href', '/products')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
