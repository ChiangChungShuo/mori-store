'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { AdminOrderListState } from '@/features/admin/order-actions'
import type { AdminPaymentReviewSummary } from '@/features/admin/order-actions'
import { filterAdminOrders } from '@/features/admin/order-server-actions'
import { formatTaipeiDateTime } from '@/lib/date-time'
import { formatTwd } from '@/lib/money'
import type { OrderStatus } from '@/types/store'

const statusLabels: Record<OrderStatus, string> = {
  pending_payment: '待付款',
  paid: '已付款',
  preparing: '備貨中',
  shipped: '已出貨',
  collected: '已取貨',
  cancelled: '已取消',
}

export function AdminOrderList({
  initialState,
  reviews,
}: {
  initialState: AdminOrderListState
  reviews: AdminPaymentReviewSummary[]
}) {
  const [state, formAction, pending] = useActionState(filterAdminOrders, initialState)

  return (
    <>
      <section>
        <h2>需人工處理的付款</h2>
        {reviews.length === 0 ? <p>目前沒有需人工處理的付款。</p> : (
          <div className="admin-table-scroll"><table className="admin-product-table">
            <thead>
              <tr>
                <th scope="col">付款交易</th>
                <th scope="col">收件人</th>
                <th scope="col">Email</th>
                <th scope="col">金額</th>
                <th scope="col">處理代碼</th>
                <th scope="col">發生時間</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((payment) => (
                <tr key={payment.id}>
                  <th scope="row">
                    <Link href={`/admin/orders/review/${payment.id}`}>{payment.id}</Link>
                  </th>
                  <td>{payment.recipientName}</td>
                  <td>{payment.email}</td>
                  <td>{formatTwd(payment.total)}</td>
                  <td>{payment.reviewCode}</td>
                  <td>{formatTaipeiDateTime(payment.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>
      <form action={formAction} className="product-filters" data-no-confirm key={`${state.query}:${state.status}`}>
        <label>
          訂單編號、收件人或 Email
          <input defaultValue={state.query} name="query" type="search" />
        </label>
        <label>
          狀態
          <select defaultValue={state.status} name="status">
            <option value="">全部狀態</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <div className="filter-actions">
          <button className="button" disabled={pending} type="submit">篩選</button>
          <button className="filter-clear-button" disabled={pending} name="clear" type="submit" value="1"><span aria-hidden="true">↺</span> 清除</button>
        </div>
      </form>
      {state.orders.length === 0 ? (
        <p className="empty-state">尚未有訂單，可先從商城送出一筆示範訂單。 <Link href="/products">前往商品列表</Link></p>
      ) : (
        <div className="admin-table-scroll"><table className="admin-product-table admin-order-table">
          <thead>
            <tr>
              <th scope="col">訂單編號</th>
              <th scope="col">收件人</th>
              <th scope="col">Email</th>
              <th scope="col">金額</th>
              <th scope="col">狀態</th>
              <th scope="col">成立時間</th>
            </tr>
          </thead>
          <tbody>
            {state.orders.map((order) => (
              <tr key={order.id}>
                <th data-label="訂單編號" scope="row"><Link href={`/admin/orders/${order.orderNumber}`}>{order.orderNumber}</Link></th>
                <td data-label="收件人">{order.recipientName}</td>
                <td data-label="Email">{order.email}</td>
                <td data-label="金額">{formatTwd(order.total)}</td>
                <td data-label="狀態"><span className="status-badge" data-status={order.status}>{statusLabels[order.status]}</span></td>
                <td data-label="成立時間">{formatTaipeiDateTime(order.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </>
  )
}
