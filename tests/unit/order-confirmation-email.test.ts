import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderOrderConfirmationEmail, type OrderConfirmationEmail } from '@/lib/email/order-confirmation'
import { sendEmail } from '@/lib/email/resend'

const baseOrder: OrderConfirmationEmail = {
  orderNumber: 'MORI-ORDER-2048',
  email: 'guest@example.com',
  recipientName: '小樹',
  items: [
    { productName: '有機棉小樹 T 恤', color: '鼠尾草綠', size: '100', quantity: 2, unitPrice: 680 },
  ],
  subtotal: 1360,
  shippingFee: 60,
  total: 1420,
  storeChain: 'seven_eleven',
  storeName: '忠孝門市',
  storeId: '123456',
  paymentMethod: 'bank_transfer',
}

describe('renderOrderConfirmationEmail', () => {
  beforeEach(() => {
    process.env.MORI_BANK_NAME = '示範銀行'
    process.env.MORI_BANK_CODE = '013'
    process.env.MORI_BANK_ACCOUNT = '01234567890123'
    process.env.MORI_BANK_ACCOUNT_NAME = 'mori 商店'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://mori.example'
  })
  afterEach(() => {
    delete process.env.MORI_BANK_NAME
    delete process.env.MORI_BANK_CODE
    delete process.env.MORI_BANK_ACCOUNT
    delete process.env.MORI_BANK_ACCOUNT_NAME
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('includes the order number in subject and body so guests can recover it', () => {
    const { subject, html } = renderOrderConfirmationEmail(baseOrder)
    expect(subject).toContain('MORI-ORDER-2048')
    expect(html).toContain('MORI-ORDER-2048')
    expect(html).toContain('有機棉小樹 T 恤')
    expect(html).toContain('鼠尾草綠')
  })

  it('shows the line total, order total and a lookup link', () => {
    const { html } = renderOrderConfirmationEmail(baseOrder)
    expect(html).toContain('NT$1,360') // line total 680 x 2
    expect(html).toContain('NT$1,420') // grand total
    expect(html).toContain('/order-lookup')
    expect(html).toContain('7-ELEVEN／忠孝門市')
  })

  it('renders bank transfer details for bank_transfer orders', () => {
    const { html } = renderOrderConfirmationEmail(baseOrder)
    expect(html).toContain('匯款資訊')
    expect(html).toContain('示範銀行')
    expect(html).toContain('01234567890123')
    expect(html).toContain('帳號末 5 碼')
  })

  it('renders COD copy and omits bank details for convenience_cod orders', () => {
    const { html } = renderOrderConfirmationEmail({ ...baseOrder, paymentMethod: 'convenience_cod' })
    expect(html).toContain('超商取貨付款')
    expect(html).not.toContain('匯款資訊')
  })

  it('escapes HTML in product names to prevent markup injection', () => {
    const { html } = renderOrderConfirmationEmail({
      ...baseOrder,
      items: [{ productName: '<script>x</script>', color: 'a', size: '1', quantity: 1, unitPrice: 100 }],
    })
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('sendEmail', () => {
  const originalKey = process.env.RESEND_API_KEY
  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = originalKey
    vi.restoreAllMocks()
  })

  it('is a no-op without RESEND_API_KEY and never calls the network', async () => {
    delete process.env.RESEND_API_KEY
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const result = await sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' })
    expect(result.status).toBe('skipped')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
