import { expect, test } from '@playwright/test'

test('homepage carousel, wishlist and cart drawer stay interactive', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email 或手機號碼').fill('admin@mori.tw')
  await page.getByLabel('密碼', { exact: true }).fill('mori123456')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL('/admin')
  await page.goto('/')

  await page.locator('.hero-carousel-controls button[aria-label^="顯示第 2 張"]').click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('把舒服')
  await expect(page.locator('.hero-carousel-controls button[aria-pressed="true"]')).toHaveText('02')

  await page.goto('/products/mori-organic-cotton-tee')
  await page.getByRole('button', { name: '收藏 有機棉小樹 T 恤' }).click()
  await expect(page.locator('.wishlist-toast')).toHaveText('已加入收藏')
  await expect(page.locator('.wishlist-header-count')).toHaveText('1')
  await expect(page.locator('.wishlist-header-link')).toHaveAttribute('data-has-items', 'true')
  await expect(page.locator('.wishlist-header-link > span').first()).toHaveText('♥')
  await expect(page.getByRole('button', { name: '移除 有機棉小樹 T 恤' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: '尺寸 100' }).click()
  await page.getByRole('button', { name: '加入購物車', exact: true }).click()
  const drawer = page.locator('.cart-drawer-panel')
  await expect(drawer).toBeVisible()
  const drawerActions = drawer.locator('.cart-drawer-actions .button')
  await expect(drawerActions).toHaveCount(2)
  for (const action of await drawerActions.all()) {
    await expect(action).toHaveCSS('transform', 'none')
  }

  await drawer.getByRole('link', { name: '查看購物車' }).click()
  await expect(page).toHaveURL(/\/cart$/)
  await expect(page.getByLabel('結帳進度').locator('li', { hasText: '購物車' })).toHaveAttribute('aria-current', 'step')

  await page.locator('.cart-drawer > summary').click()
  await page.locator('.cart-drawer-panel').getByRole('link', { name: '前往結帳' }).click()
  await expect(page).toHaveURL('/checkout')
})

test('owner can edit homepage carousel copy from store settings', async ({ page }) => {
  await page.goto('/login?next=/admin/settings')
  await page.getByLabel('Email').fill('admin@mori.tw')
  await page.getByLabel('密碼', { exact: true }).fill('mori123456')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL('/admin')
  await page.goto('/admin/settings')
  await expect(page.getByRole('heading', { name: '首頁輪播圖' })).toBeVisible()

  const firstTitle = page.locator('textarea[name="title-0"]')
  await firstTitle.fill('後台可自訂的首頁輪播')
  await page.getByRole('button', { name: '儲存首頁輪播' }).click()
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('後台可自訂')

  await page.goto('/admin/settings')
  await page.locator('textarea[name="title-0"]').fill('小小日常，\n自在長大。')
  await page.getByRole('button', { name: '儲存首頁輪播' }).click()
})

test('checkout validates a promotion code and carries the discount into payment', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email 或手機號碼').fill('admin@mori.tw')
  await page.getByLabel('密碼', { exact: true }).fill('mori123456')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL('/admin')
  await page.goto('/')
  await page.waitForFunction(() => window.localStorage.getItem('mori-cart-v1') !== null)
  await page.evaluate(() => {
    window.localStorage.setItem('mori-cart-v1', JSON.stringify([{
      variantId: '00000000-0000-4000-8000-000000000001',
      productSlug: 'mori-organic-cotton-tee',
      name: '有機棉小樹 T 恤',
      imageUrl: null,
      color: '鼠尾草綠',
      size: '100',
      unitPrice: 680,
      quantity: 2,
      maxStock: 12,
    }]))
  })
  await page.goto('/cart')
  await page.getByLabel('優惠碼').fill('hellomori')
  await page.getByRole('button', { name: '套用' }).click()
  await expect(page.getByText('已套用 HELLOMORI，折抵 NT$100。')).toBeVisible()
  await expect(page.getByRole('complementary', { name: '訂單摘要' }).locator('.cart-total')).toContainText('NT$1,320')

  await page.getByRole('link', { name: '前往結帳' }).click()
  await page.getByLabel('Email').fill('coupon@example.com')
  await page.getByLabel('收件人姓名').fill('王小美')
  await page.getByLabel('手機號碼').fill('0912345678')
  await page.getByLabel('取貨門市名稱').fill('台北門市')
  await page.getByLabel('門市店號').fill('123456')

  await expect(page.locator('.checkout-discount')).toContainText('優惠碼 HELLOMORI')
  await expect(page.locator('.checkout-grand-total')).toContainText('NT$1,320')

  await page.getByRole('button', { name: '送出資料，確認訂單' }).click()
  await expect(page).toHaveURL(/\/checkout\/payment\/[0-9a-f-]+$/)
  await expect(page.getByLabel('付款訂單摘要')).toContainText('NT$1,320')
})
