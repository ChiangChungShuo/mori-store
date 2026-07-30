import { expect, test } from '@playwright/test'

const hasLiveData = process.env.HAS_LIVE_DATA === '1'
const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD

test.describe('admin product inventory', () => {
  test.skip(!hasLiveData || !email || !password, 'requires HAS_LIVE_DATA=1 and admin credentials')

  test('creates, edits and publishes a storefront-visible product', async ({ page }) => {
    const suffix = Date.now().toString()
    const slug = `e2e-color-pocket-tee-${suffix}`

    await page.goto('/login?next=/admin/products/new')
    await page.getByLabel('Email').fill(email ?? '')
    await page.getByLabel('密碼').fill(password ?? '')
    await page.getByRole('button', { name: '登入' }).click()
    await expect(page).toHaveURL(/\/admin\/products\/new$/)

    await page.getByLabel('商品名稱').fill('E2E 彩色口袋 Tee')
    await page.getByLabel('網址代稱').fill(slug)
    await page.getByLabel('分類').selectOption('上衣')
    await page.getByLabel('3-5 歲').check()
    await page.getByLabel('SKU').fill(`E2E-TEE-${suffix}`)
    await page.getByLabel('顏色').fill('黃色')
    await page.getByLabel('尺寸', { exact: true }).selectOption('100')
    await page.getByLabel('售價').fill('590')
    await page.getByLabel('庫存').selectOption('3')
    await page.getByRole('button', { name: '儲存商品' }).click()
    await page.getByRole('button', { name: '確定儲存' }).click()
    await expect(page.getByRole('status')).toContainText(/已儲存/)
    await page.getByRole('link', { name: '前往商品圖片與上架設定' }).click()

    await page.getByLabel('商品名稱').fill('E2E 彩色口袋 Tee 已編輯')
    await page.getByRole('button', { name: '儲存商品' }).click()
    await page.getByRole('button', { name: '確定儲存' }).click()
    await expect(page.getByRole('status')).toContainText(/已儲存/)

    await page.getByLabel('圖片').setInputFiles({
      name: 'product.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    })
    await page.getByLabel('圖片替代文字').fill('E2E 彩色口袋 Tee 正面')
    await page.getByRole('button', { name: '上傳圖片' }).click()
    await page.getByRole('button', { name: '確定儲存' }).click()
    await expect(page.getByText(/圖片已上傳/)).toBeVisible()

    await page.getByRole('button', { name: '上架商品' }).click()
    await page.getByRole('button', { name: '確定儲存' }).click()
    await expect(page.getByText('商品已上架', { exact: true })).toBeVisible()

    await page.goto(`/products/${slug}`)
    await expect(page.getByRole('heading', { name: 'E2E 彩色口袋 Tee 已編輯' })).toBeVisible()
  })
})
