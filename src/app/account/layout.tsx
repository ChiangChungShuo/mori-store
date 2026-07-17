import { signOut } from '@/features/auth/actions'
import { requireUser } from '@/lib/auth/require-user'

export default async function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireUser()

  return (
    <>
      <form action={signOut} className="section">
        <button className="button" type="submit">登出</button>
      </form>
      {children}
    </>
  )
}
