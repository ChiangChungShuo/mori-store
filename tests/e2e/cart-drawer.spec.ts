import { expect, test } from '@playwright/test'

test('adding a product opens a complete editable cart drawer', async ({ page }) => {
  await page.goto('/products/mori-organic-cotton-tee')
  await page.getByRole('button', { name: '尺寸 100' }).click()
  await page.getByRole('button', { name: '加入購物車' }).click()

  const drawer = page.getByRole('group', { name: '購物車內容' })
  await expect(drawer).toHaveAttribute('open', '')
  await expect(drawer.getByRole('img', { name: '有機棉小樹 T 恤' })).toBeVisible()
  await expect(drawer.getByText('鼠尾草綠／尺寸 100')).toBeVisible()
  await expect(drawer.getByLabel(/免運進度/)).toBeVisible()
  await expect(drawer.getByText('商品小計').locator('..')).toContainText('NT$680')
  await expect(drawer.getByText('運費').locator('..')).toContainText('NT$60')
  await expect(drawer.getByText('合計').locator('..')).toContainText('NT$740')

  await drawer.getByRole('button', { name: '增加 有機棉小樹 T 恤 數量' }).click()
  await expect(drawer.getByRole('status', { name: '有機棉小樹 T 恤 數量' })).toHaveText('2')
  await expect(drawer.getByText('商品小計').locator('..')).toContainText('NT$1,360')
  await expect(drawer.getByText('合計').locator('..')).toContainText('NT$1,420')
})
