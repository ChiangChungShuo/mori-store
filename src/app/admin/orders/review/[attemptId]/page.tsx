import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAdminPaymentReview } from '@/features/admin/order-actions'
import { formatTaipeiDateTime } from '@/lib/date-time'
import { formatTwd } from '@/lib/money'

export const dynamic = 'force-dynamic'

const storeChainLabels: Record<string, string> = {
  seven_eleven: '7-ELEVEN',
  family_mart: '全家',
}

export default async function AdminPaymentReviewPage({
  params,
}: {
  params: Promise<{ attemptId: string }>
}) {
  const { attemptId } = await params
  const payment = await getAdminPaymentReview(attemptId)
  if (!payment) notFound()

  return (
    <main className="section">
      <p><Link href="/admin/orders">← 返回訂單管理</Link></p>
      <header className="admin-page-heading">
        <div><p className="eyebrow">admin / payment review</p><h1>需人工處理的付款</h1></div>
      </header>
      <dl className="order-result">
        <div><dt>付款交易</dt><dd>{payment.id}</dd></div>
        <div><dt>處理代碼</dt><dd>{payment.reviewCode}</dd></div>
        <div><dt>原因</dt><dd>{payment.reviewReason}</dd></div>
        <div><dt>付款識別碼</dt><dd>{payment.providerReference ?? '—'}</dd></div>
        <div><dt>發生時間</dt><dd>{formatTaipeiDateTime(payment.createdAt)}</dd></div>
      </dl>

      <section>
        <h2>顧客與門市</h2>
        <dl className="order-result">
          <div><dt>收件人</dt><dd>{payment.recipientName}</dd></div>
          <div><dt>手機</dt><dd>{payment.recipientPhone}</dd></div>
          <div><dt>Email</dt><dd>{payment.email}</dd></div>
          <div><dt>門市</dt><dd>{storeChainLabels[payment.storeChain] ?? payment.storeChain}／{payment.storeName}（{payment.storeId}）</dd></div>
        </dl>
      </section>

      <section>
        <h2>付款商品快照</h2>
        <table className="admin-product-table">
          <thead>
            <tr>
              <th scope="col">商品</th>
              <th scope="col">規格</th>
              <th scope="col">單價</th>
              <th scope="col">數量</th>
            </tr>
          </thead>
          <tbody>
            {payment.items.map((item) => (
              <tr key={item.variantId}>
                <th scope="row">{item.productName}</th>
                <td>{item.color}／{item.size}／{item.sku}</td>
                <td>{formatTwd(item.unitPrice)}</td>
                <td>{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="order-result">
          <div><dt>商品小計</dt><dd>{formatTwd(payment.subtotal)}</dd></div>
          <div><dt>運費</dt><dd>{formatTwd(payment.shippingFee)}</dd></div>
          <div><dt>總計</dt><dd>{formatTwd(payment.total)}</dd></div>
        </dl>
      </section>
    </main>
  )
}
