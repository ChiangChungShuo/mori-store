'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { AdminOrderListState } from '@/features/admin/order-actions'
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

export function AdminOrderList({ initialState }: { initialState: AdminOrderListState }) {
  const [state, formAction, pending] = useActionState(filterAdminOrders, initialState)

  return (
    <>
      <form action={formAction} className="product-filters" key={`${state.query}:${state.status}`}>
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
          <button disabled={pending} name="clear" type="submit" value="1">清除</button>
        </div>
      </form>
      {state.orders.length === 0 ? (
        <p>沒有符合條件的訂單。</p>
      ) : (
        <table className="admin-product-table">
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
                <th scope="row"><Link href={`/admin/orders/${order.orderNumber}`}>{order.orderNumber}</Link></th>
                <td>{order.recipientName}</td>
                <td>{order.email}</td>
                <td>{formatTwd(order.total)}</td>
                <td>{statusLabels[order.status]}</td>
                <td>{formatTaipeiDateTime(order.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
