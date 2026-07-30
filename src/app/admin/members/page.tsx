import Link from 'next/link'
import { listMembers, memberTierLabels, updateMemberFromForm } from '@/features/admin/business-management'
import { MemberSettingsForm } from '@/features/admin/member-settings-form'
import { orderStatusLabels } from '@/features/orders/status'
import { formatTaipeiDateTime } from '@/lib/date-time'
import { formatTwd } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function AdminMembersPage() {
  const members = await listMembers()
  const totalValue = members.reduce((total, member) => total + member.totalSpent, 0)

  return (
    <main className="section admin-management-page">
      <header className="admin-page-heading">
        <div><p className="eyebrow">customers / loyalty</p><h1>會員經營</h1></div>
        <p>依消費記錄分級，統一管理紅利與會員折扣。</p>
      </header>

      <section className="admin-metrics admin-metrics-compact">
        <article className="metric-feature"><p>顧客數</p><strong>{members.length}</strong><small>包含會員與訪客購買者</small></article>
        <article><p>累計貢獻</p><strong>{formatTwd(totalValue)}</strong><small>已付款以上訂單</small></article>
        <article><p>VIP 會員</p><strong>{members.filter((member) => member.tier === 'canopy').length}</strong><small>樹冠等級</small></article>
      </section>

      <section className="admin-panel">
        <header><div><p className="eyebrow">member database</p><h2>顧客資料庫</h2></div></header>
        {members.length === 0 ? <p>完成註冊或第一筆訂單後，顧客會出現在這裡。</p> : (
          <div className="admin-member-list">
            {members.map((member) => (
              <article key={member.id} className="admin-member-card">
                <div className="member-identity">
                  <span>{member.name.slice(0, 1)}</span>
                  <div><strong>{member.name}</strong><small>{member.email} · {member.phone ?? '未註冊會員手機'} · {member.accountType}</small></div>
                </div>
                <dl>
                  <div><dt>訂單</dt><dd>{member.orderCount} 筆</dd></div>
                  <div><dt>消費</dt><dd>{formatTwd(member.totalSpent)}</dd></div>
                </dl>
                <MemberSettingsForm
                  action={updateMemberFromForm}
                  discountPercent={member.discountPercent}
                  email={member.email}
                  labels={memberTierLabels}
                  points={member.points}
                  tier={member.tier}
                />
                <details>
                  <summary>查看訂單紀錄</summary>
                  {member.orders.length === 0 ? <p>尚無訂單。</p> : <ul>{member.orders.map((order) => (
                    <li key={order.orderNumber}><Link href={`/admin/orders/${order.orderNumber}`}>{order.orderNumber}</Link><span>{formatTaipeiDateTime(order.createdAt)}</span><strong>{formatTwd(order.total)} · {orderStatusLabels[order.status]}</strong></li>
                  ))}</ul>}
                </details>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
