import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listMembers } from '@/features/admin/business-management'
import { getAccountSummary } from '@/features/account/summary'
import { getE2EStore } from '@/testing/e2e-store'

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ({ id: 'admin', email: 'admin@mori.tw', role: 'admin' })),
}))

const memberId = '00000000-0000-4000-8000-000000008888'
const memberEmail = 'phone-member@example.com'

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('MORI_E2E_FIXTURES', '1')
  vi.stubEnv('VERCEL_ENV', '')
  getE2EStore().users.set(memberId, {
    id: memberId,
    email: memberEmail,
    role: 'customer',
    displayName: '王小美',
    phone: '0912345678',
    termsAcceptedAt: '2026-07-28T03:00:00.000Z',
    marketingConsentAt: null,
    passwordSalt: 'salt',
    passwordHash: 'hash',
  })
})

afterEach(() => {
  getE2EStore().users.delete(memberId)
  vi.unstubAllEnvs()
})

describe('member contact display', () => {
  it('returns the registered phone to the member account summary', async () => {
    const summary = await getAccountSummary({
      id: memberId,
      email: memberEmail,
      role: 'customer',
    })

    expect(summary.phone).toBe('0912345678')
  })

  it('returns phone and consent time to the owner member list', async () => {
    const member = (await listMembers()).find((candidate) => candidate.id === memberId)

    expect(member).toMatchObject({
      email: memberEmail,
      phone: '0912345678',
      termsAcceptedAt: '2026-07-28T03:00:00.000Z',
      accountType: '會員',
    })
  })

  it('labels the phone in member and owner views', () => {
    const accountPage = readFileSync(resolve(process.cwd(), 'src/app/account/page.tsx'), 'utf8')
    const adminPage = readFileSync(resolve(process.cwd(), 'src/app/admin/members/page.tsx'), 'utf8')

    expect(accountPage).toMatch(/手機號碼/)
    expect(adminPage).toMatch(/member\.phone/)
  })
})
