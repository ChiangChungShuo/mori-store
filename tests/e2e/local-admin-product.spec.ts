import { expect, test } from '@playwright/test'

test('owner creates a product with one complete variant in local fixture mode', async ({ page }) => {
  test.setTimeout(60_000)
  test.skip(Boolean(process.env.E2E_BASE_URL), 'local fixture product creation only')
  const suffix = Date.now().toString()
  const productName = `單一規格測試上衣 ${suffix}`

  await page.goto('/login?next=/admin/products/new')
  await page.getByLabel('Email').fill('admin@mori.tw')
  await page.getByLabel('密碼', { exact: true }).fill('mori123456')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL('/admin')
  await page.goto('/admin/products/new')
  await expect(page.locator('.admin-product-steps')).toHaveCSS('position', 'static')
  await expect(page.getByRole('progressbar', { name: '商品建立進度' })).toHaveAttribute('aria-valuenow', '0')

  await page.getByLabel('商品名稱').fill(productName)
  await page.getByLabel('網址代稱').fill(`single-variant-${suffix}`)
  await page.getByLabel('分類').selectOption('上衣')
  await page.getByRole('checkbox', { name: /Kids/ }).check()
  await page.getByLabel('商品說明').fill('柔軟親膚的日常上衣。')
  await page.getByLabel('材質').fill('100% 棉')
  await page.getByLabel('尺寸指南').fill('正常版型，依平常尺寸選購。')
  await page.getByLabel('洗滌說明').fill('冷水柔洗並自然晾乾。')
  await expect(page.locator('.admin-product-steps').getByText('02 規格庫存')).toHaveAttribute('data-active', 'true')
  await page.getByLabel('SKU').fill(`MORI-SINGLE-${suffix}`)
  await page.getByLabel('顏色').fill('森林綠')
  await page.getByLabel('尺寸', { exact: true }).fill('110')
  await page.getByLabel('售價').fill('690')
  await page.getByLabel('庫存').fill('5')

  await expect(page.locator('.admin-product-steps').getByText('03 商品圖片')).toHaveAttribute('data-active', 'true')
  const imageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  await page.getByLabel('商品圖片').setInputFiles([
    { name: 'single-product-front.png', mimeType: 'image/png', buffer: imageBuffer },
    { name: 'single-product-back.png', mimeType: 'image/png', buffer: imageBuffer },
  ])
  await expect(page.getByText('已選擇 2 張圖片')).toBeVisible()
  await page.getByLabel('圖片說明').fill('單一規格測試上衣正面照')

  await expect(page.locator('.admin-product-steps').getByText('04 確認建立')).toHaveAttribute('data-active', 'true')
  await expect(page.getByRole('progressbar', { name: '商品建立進度' })).toHaveAttribute('aria-valuenow', '100')
  await page.getByRole('button', { name: '儲存並建立商品' }).click()
  await expect(page.getByRole('dialog', { name: '商品建立完成' })).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('商品與 2 張圖片已建立')
  await expect(page.getByText(/完整填寫每個規格/)).toHaveCount(0)

  await page.getByRole('dialog').getByRole('link', { name: '前往編輯商品', exact: true }).click()
  await expect(page.locator('.admin-product-image-grid img')).toHaveCount(2)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '刪除圖片 2' }).click()
  await expect(page.locator('.admin-product-image-grid img')).toHaveCount(1)

  const updatedName = `${productName} 已更新`
  await page.getByLabel('商品名稱').fill(updatedName)
  await page.getByRole('button', { name: '儲存商品' }).click()
  await expect(page.getByRole('status')).toContainText('商品修改已儲存')
  await page.getByRole('link', { name: '← 返回商品列表' }).click()
  const productRow = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: updatedName }) })
  await expect(productRow).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await productRow.getByRole('button', { name: '刪除' }).click()
  await expect(page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: updatedName }) })).toHaveCount(0)
})
