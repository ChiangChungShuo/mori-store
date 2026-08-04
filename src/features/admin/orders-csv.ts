import { orderStatusLabels } from '@/features/orders/status'
import { formatTaipeiDateTime } from '@/lib/date-time'
import type { AdminOrderDetail } from '@/features/admin/order-actions'

const storeChainLabels: Record<string, string> = {
  seven_eleven: '7-ELEVEN',
  family_mart: '全家',
}

const paymentMethodLabels: Record<string, string> = {
  bank_transfer: '銀行匯款',
  convenience_cod: '超商取貨付款',
  online_test: '線上付款',
}

export const orderCsvColumns = [
  '訂單編號', '成立時間', '狀態', '收件人', '電話', 'Email',
  '通路', '取貨門市', '門市代號', '付款方式', '匯款末五碼',
  '商品明細', '商品小計', '運費', '訂單總計', '買家留言',
] as const

// Quote every field and double inner quotes so commas, line breaks and Chinese
// punctuation survive Excel, Numbers and Google Sheets.
function toCsvRow(values: string[]) {
  return values.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')
}

export function buildOrdersCsv(orders: AdminOrderDetail[]) {
  const rows = orders.map((order) => toCsvRow([
    order.orderNumber,
    formatTaipeiDateTime(order.createdAt),
    orderStatusLabels[order.status],
    order.recipientName,
    order.recipientPhone,
    order.email,
    storeChainLabels[order.storeChain] ?? order.storeChain,
    order.storeName,
    order.storeId,
    paymentMethodLabels[order.paymentMethod] ?? order.paymentMethod,
    order.bankTransferLastFive ?? '',
    order.items.map((item) => `${item.productName} ${item.color}/${item.size} x${item.quantity}`).join('；'),
    String(order.subtotal),
    String(order.shippingFee),
    String(order.total),
    order.customerNote,
  ]))

  // The BOM makes Excel read the file as UTF-8 instead of Big5.
  return `﻿${toCsvRow([...orderCsvColumns])}\n${rows.join('\n')}\n`
}
