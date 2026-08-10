import { describe, expect, it } from 'vitest'
import { buildOrdersCsv, orderCsvColumns } from '@/features/admin/orders-csv'
import type { AdminOrderDetail } from '@/features/admin/order-actions'

const order: AdminOrderDetail = {
  id: 'order-1',
  orderNumber: 'MORI-69D0E0823B',
  recipientName: '郭亮妘',
  recipientPhone: '0912345678',
  email: 'moribaby0612@gmail.com',
  total: 740,
  status: 'paid',
  createdAt: '2026-07-30T09:58:06.000Z',
  storeChain: 'seven_eleven',
  storeId: '123456',
  storeName: '駕勝門市',
  customerNote: '請包好，謝謝：)',
  merchantReply: '',
  trackingCode: null,
  paymentMethod: 'bank_transfer',
  bankTransferLastFive: '54321',
  bankTransferSubmittedAt: null,
  subtotal: 680,
  shippingFee: 60,
  items: [
    { id: 'item-1', productName: '有機棉小樹 T 恤', sku: 'MORI-TEE-100', color: '鼠尾草綠', size: '100', unitPrice: 680, quantity: 1 },
  ],
  payment: null,
}

describe('buildOrdersCsv', () => {
  it('starts with a UTF-8 BOM and the column header', () => {
    const csv = buildOrdersCsv([])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain(`"${orderCsvColumns[0]}"`)
    expect(csv).toContain('"買家留言"')
  })

  it('writes recipient, store and item details for each order', () => {
    const [, row] = buildOrdersCsv([order]).split('\n')
    expect(row).toContain('"MORI-69D0E0823B"')
    expect(row).toContain('"郭亮妘"')
    expect(row).toContain('"0912345678"')
    expect(row).toContain('"7-ELEVEN"')
    expect(row).toContain('"駕勝門市"')
    expect(row).toContain('"銀行匯款"')
    expect(row).toContain('"54321"')
    expect(row).toContain('有機棉小樹 T 恤 鼠尾草綠/100 x1')
    expect(row).toContain('"680"')
    expect(row).toContain('"60"')
    expect(row).toContain('"740"')
    expect(row).toContain('"已付款"')
  })

  it('escapes quotes so a note can never break the column layout', () => {
    const csv = buildOrdersCsv([{ ...order, customerNote: '請寫「mori」, 謝謝"急件"' }])
    expect(csv).toContain('"請寫「mori」, 謝謝""急件"""')
    // One header row plus one order row plus the trailing newline.
    expect(csv.trimEnd().split('\n')).toHaveLength(2)
  })
})
