import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMemberDetail, memberTierLabels, updateMemberFromForm } from '@/features/admin/business-management'
import { MemberSettingsForm } from '@/features/admin/member-settings-form'
import { orderStatusLabels } from '@/features/orders/status'
import { formatTaipeiDateTime } from '@/lib/date-time'
import { formatTwd } from '@/lib/money'

export const dynamic = 'force-dynamic'

type MemberDetailPageProps = {
  params: Promise<{ email: string }>
}

export default async function AdminMemberDetailPage({ params }: MemberDetailPageProps) {
  const { email } = await params
  const member = await getMemberDetail(decodeURIComponent(email))
  if (!member) notFound()

  return (
    <main className="section admin-management-page">
      <div className="admin-category-toolbar"><Link href="/admin/members">← 返回會員列表</Link></div>
      <header className="admin-page-heading">
        <div><p className="eyebrow">member profile</p><h1>{member.name}</h1></div>
        <p>{member.accountType}・{memberTierLabels[member.tier]}</p>
      </header>

      <section className="admin-panel admin-member-detail">
        <header><div><p className="eyebrow">contact</p><h2>基本資料</h2></div></header>
        <dl className="admin-member-detail-facts">
          <div><dt>Email</dt><dd>{member.email}</dd></div>
          <div><dt>手機</dt><dd>{member.phone ?? '未提供'}</dd></div>
          <div><dt>帳號類型</dt><dd>{member.accountType}</dd></div>
          <div><dt>加入 / 同意條款</dt><dd>{member.termsAcceptedAt ? formatTaipeiDateTime(member.termsAcceptedAt) : '—'}</dd></div>
          <div><dt>訂單數</dt><dd>{member.orderCount} 筆</dd></div>
          <div><dt>累計消費</dt><dd>{formatTwd(member.totalSpent)}</dd></div>
        </dl>
      </section>

      <section className="admin-panel">
        <header><div><p className="eyebrow">loyalty</p><h2>等級與紅利</h2></div></header>
        <MemberSettingsForm
          action={updateMemberFromForm}
          discountPercent={member.discountPercent}
          email={member.email}
          labels={memberTierLabels}
          points={member.points}
          tier={member.tier}
        />
      </section>

      <section className="admin-panel">
        <header><div><p className="eyebrow">orders</p><h2>訂單紀錄</h2></div><strong>{member.orders.length} 筆</strong></header>
        {member.orders.length === 0 ? <p>尚無訂單。</p> : (
          <ul className="admin-member-order-list">
            {member.orders.map((order) => (
              <li key={order.orderNumber}>
                <Link href={`/admin/orders/${order.orderNumber}`}>{order.orderNumber}</Link>
                <span>{formatTaipeiDateTime(order.createdAt)}</span>
                <strong>{formatTwd(order.total)}・{orderStatusLabels[order.status]}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
