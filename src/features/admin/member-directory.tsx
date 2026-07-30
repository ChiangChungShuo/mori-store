'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatTwd } from '@/lib/money'
import type { MemberRecord } from '@/features/admin/business-management'

export function MemberDirectory({
  members,
  tierLabels,
}: {
  members: MemberRecord[]
  tierLabels: Record<string, string>
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q
    ? members.filter((member) =>
        member.name.toLowerCase().includes(q)
        || member.email.toLowerCase().includes(q)
        || (member.phone ?? '').includes(q))
    : members

  return (
    <div className="admin-member-directory">
      <input
        aria-label="搜尋會員"
        className="admin-member-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜尋姓名、Email 或電話"
        type="search"
        value={query}
      />
      {filtered.length === 0 ? <p>找不到符合的會員。</p> : (
        <ul className="admin-member-rows">
          {filtered.map((member) => (
            <li key={member.id}>
              <Link className="admin-member-row" href={`/admin/members/${encodeURIComponent(member.email)}`}>
                <span className="admin-member-avatar" aria-hidden="true">{member.name.slice(0, 1)}</span>
                <span className="admin-member-name"><strong>{member.name}</strong><small>{member.email}</small></span>
                <span className="admin-member-cell">{member.phone ?? '—'}</span>
                <span className="admin-member-cell">{member.accountType}</span>
                <span className="admin-member-cell admin-member-tier-badge">{tierLabels[member.tier]}</span>
                <span className="admin-member-cell">{member.orderCount} 筆</span>
                <span className="admin-member-cell admin-member-spent">{formatTwd(member.totalSpent)}</span>
                <span className="admin-member-chevron" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
