import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { resolveProtectedDestination } from '@/lib/auth/protection'
import { createClient } from '@/lib/supabase/server'
import { isE2EMode } from '@/testing/e2e-mode'
import type { AuthenticatedUser } from '@/testing/e2e-auth-repository'

export async function requireUser(pathname = '/account'): Promise<User | AuthenticatedUser> {
  const user = await getCurrentUser()
  if (!user) redirect(resolveProtectedDestination(null, pathname) ?? '/login')
  return user
}

export async function getCurrentUser(): Promise<User | AuthenticatedUser | null> {
  if (isE2EMode()) {
    const { getE2ECurrentUser } = await import('@/testing/e2e-auth-repository')
    return getE2ECurrentUser()
  }

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  return error ? null : user
}
