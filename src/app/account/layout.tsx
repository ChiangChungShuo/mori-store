import { requireUser } from '@/lib/auth/require-user'

export default async function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireUser()

  return children
}
