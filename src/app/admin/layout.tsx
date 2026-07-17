import { requireAdmin } from '@/lib/auth/require-admin'

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin()

  return children
}
