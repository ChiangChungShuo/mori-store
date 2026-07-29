import Link from 'next/link'
import { AccountOrderRow } from '@/features/account/account-order-row'
import { listOrdersForUser } from '@/features/orders/queries'
import { requireUser } from '@/lib/auth/require-user'

type OrdersPageProps = { searchParams: Promise<{ status?: string }> }

const filters = [
  { value: 'all', label: '全部訂單' },
  { value: 'active', label: '處理中' },
  { value: 'collected', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
] as const

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const user = await requireUser()
  const orders = await listOrdersForUser(user.id)
  const requestedStatus = (await searchParams).status ?? 'all'
  const status = filters.some((filter) => filter.value === requestedStatus) ? requestedStatus : 'all'
  const visibleOrders = orders.filter((order) => {
    if (status === 'all') return true
    if (status === 'active') return !['collected', 'cancelled'].includes(order.status)
    return order.status === status
  })

  return (
    <main className="account-page">
      <header className="account-page-heading">
        <div><p className="eyebrow">order history</p><h1>我的訂單</h1></div>
        <p>查看每筆訂單的付款、備貨、配送與取貨進度。</p>
      </header>

      <nav className="account-order-tabs" aria-label="訂單狀態篩選">
        {filters.map((filter) => <Link aria-current={status === filter.value ? 'page' : undefined} href={filter.value === 'all' ? '/account/orders' : `/account/orders?status=${filter.value}`} key={filter.value}>{filter.label}<span>{filter.value === 'all' ? orders.length : filter.value === 'active' ? orders.filter((order) => !['collected', 'cancelled'].includes(order.status)).length : orders.filter((order) => order.status === filter.value).length}</span></Link>)}
      </nav>

      <section className="account-orders-panel">
        <div className="account-orders-labels"><span>訂單資訊</span><span>商品／取貨門市</span><span>金額</span><span>狀態</span><span>操作</span></div>
        {visibleOrders.length === 0 ? (
          <div className="account-empty"><span aria-hidden="true">單</span><h2>{orders.length ? '這個分類目前沒有訂單' : '還沒有訂單'}</h2><p>{orders.length ? '可以切換上方分類查看其他訂單。' : '完成第一次購物後，付款與取貨進度會出現在這裡。'}</p>{!orders.length && <Link className="button" href="/products">開始選購</Link>}</div>
        ) : visibleOrders.map((order) => <AccountOrderRow key={order.orderNumber} order={order} />)}
      </section>

      <aside className="account-order-help">
        <div><strong>找不到訂單？</strong><p>訂單需使用下單時的會員帳號才會顯示；訪客訂單可用訂單編號與 Email 查詢。</p></div>
        <Link href="/order-lookup">查詢訪客訂單 →</Link>
      </aside>
      {orders.length > 0 && (
        <p className="account-order-count">共 {orders.length} 筆訂單</p>
      )}
    </main>
  )
}
