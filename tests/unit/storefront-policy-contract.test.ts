import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('storefront policy and service copy', () => {
  it('shows only 7-ELEVEN in new-order storefront surfaces', () => {
    const storefront = [
      'src/app/(store)/checkout/page.tsx',
      'src/app/(store)/faq/page.tsx',
      'src/app/(store)/products/[slug]/page.tsx',
      'src/app/(store)/terms/page.tsx',
      'src/components/site-footer.tsx',
      'src/components/site-header.tsx',
      'src/features/checkout/checkout-form.tsx',
      'src/features/checkout/store-picker.tsx',
    ].map(source).join('\n')

    expect(storefront).toContain('7-ELEVEN')
    expect(storefront).not.toContain('全家')
  })

  it('includes the Instagram contact and the fixed kids size guide', () => {
    expect(source('src/app/(store)/contact/page.tsx')).toContain('mori.murbebe')
    expect(source('src/components/site-footer.tsx')).toContain('mori.murbebe')

    const productPage = source('src/app/(store)/products/[slug]/page.tsx')
    expect(productPage).toContain('建議年齡')
    expect(productPage).toContain('建議體重')
    expect(productPage).toContain("size: '140'")
    expect(productPage).toContain('className="measurement-guide-image"')
  })

  it('states the statutory return window consistently across storefront policy surfaces', () => {
    const returnsPage = source('src/app/(store)/returns/page.tsx')
    expect(returnsPage).toContain('七日解除權')
    expect(returnsPage).toContain('收貨次日起七日內')
    expect(returnsPage).toContain('瑕疵品定義')
    expect(returnsPage).toContain('鑑賞期並非試用期')
    expect(returnsPage).toContain('商品售出後不做退換')

    expect(source('src/app/(store)/faq/page.tsx')).toContain('商品售出後不做退換')
  })

  it('keeps product-page shopping guidance concise and moves full policy copy to FAQ', () => {
    const productPage = source('src/app/(store)/products/[slug]/page.tsx')
    const faqPage = source('src/app/(store)/faq/page.tsx')
    const footer = source('src/components/site-footer.tsx')

    expect(productPage).toContain('<summary>購物提醒</summary>')
    expect(productPage).toContain('預購商品約 14–21 個工作天出貨')
    expect(productPage).toContain('付款完成後才會保留庫存')
    expect(productPage).toContain('收到商品後請儘速檢查')
    expect(productPage).toContain('href="/faq#faq-shopping"')
    expect(productPage).toContain('href="/faq#faq-returns"')
    expect(productPage).not.toContain('建議開箱時全程錄影')
    expect(productPage).not.toContain('商品本體、吊牌、配件及包裝完整')

    expect(faqPage).toContain("eyebrow: 'shopping'")
    expect(faqPage).toContain('商品價格、尺寸、顏色、款式、數量、商品描述及預計出貨時間')
    expect(faqPage).toContain('建議開箱時全程錄影')
    expect(faqPage).toContain('七日鑑賞期（法律上的七日解除權）')

    expect(footer).toContain('href="/faq#faq-shopping">購物須知')
    expect(footer).toContain('href="/returns">退換貨政策')
    expect(footer).toContain('href="/faq">常見問題')
  })
})
