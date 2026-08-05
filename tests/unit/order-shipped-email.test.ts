import { describe, expect, it } from 'vitest'
import { renderOrderShippedEmail } from '@/lib/email/order-shipped'

describe('renderOrderShippedEmail', () => {
  const order = {
    orderNumber: 'MORI-69D0E0823B',
    email: 'parent@example.com',
    recipientName: '郭亮妘',
    storeChain: 'seven_eleven',
    storeName: '駕勝門市',
    storeId: '123456',
    itemCount: 2,
  }

  it('names the pickup store and the collection deadline', () => {
    const { subject, html } = renderOrderShippedEmail(order)

    expect(subject).toBe('【MORIMUR BABY】商品已出貨 MORI-69D0E0823B')
    expect(html).toContain('MORI-69D0E0823B')
    expect(html).toContain('7-ELEVEN／駕勝門市')
    expect(html).toContain('店號 123456')
    expect(html).toContain('共 2 件商品')
    // The deadline is the reason this email exists.
    expect(html).toContain('保留 7 天')
  })

  it('still reads correctly without a recipient name or store', () => {
    const { html } = renderOrderShippedEmail({ orderNumber: 'MORI-1', email: 'a@b.co' })

    expect(html).toContain('你好：')
    expect(html).toContain('超商')
    expect(html).not.toContain('共  件商品')
  })

  it('escapes store names so a stray quote cannot break the markup', () => {
    const { html } = renderOrderShippedEmail({ ...order, storeName: '「測試」<門市>' })

    expect(html).toContain('&lt;門市&gt;')
    expect(html).not.toContain('<門市>')
  })
})
