import { listMembers, memberTierLabels } from '@/features/admin/business-management'
import { MemberDirectory } from '@/features/admin/member-directory'
import { formatTwd } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function AdminMembersPage() {
  const members = await listMembers()
  const totalValue = members.reduce((total, member) => total + member.totalSpent, 0)

  return (
    <main className="section admin-management-page">
      <header className="admin-page-heading">
        <div><p className="eyebrow">customers / loyalty</p><h1>會員經營</h1></div>
        <p>依消費記錄分級，統一管理紅利與會員折扣。點擊會員可查看完整資料與編輯。</p>
      </header>

      <section className="admin-metrics admin-metrics-compact">
        <article className="metric-feature"><p>顧客數</p><strong>{members.length}</strong><small>包含會員與訪客購買者</small></article>
        <article><p>累計貢獻</p><strong>{formatTwd(totalValue)}</strong><small>已付款以上訂單</small></article>
        <article><p>VIP 會員</p><strong>{members.filter((member) => member.tier === 'canopy').length}</strong><small>樹冠等級</small></article>
      </section>

      <section className="admin-panel">
        <header><div><p className="eyebrow">member database</p><h2>顧客資料庫</h2></div></header>
        {members.length === 0
          ? <p>完成註冊或第一筆訂單後，顧客會出現在這裡。</p>
          : <MemberDirectory members={members} tierLabels={memberTierLabels} />}
      </section>
    </main>
  )
}
