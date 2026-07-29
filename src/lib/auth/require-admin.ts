import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireUser, getCurrentUser } from './require-user'
import { isE2EMode } from '@/testing/e2e-mode'
import type { AuthenticatedUser } from '@/testing/e2e-auth-repository'

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false

  if (isE2EMode()) {
    return 'role' in user && user.role === 'admin'
  }

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return !error && profile?.role === 'admin'
}

export async function requireAdmin(): Promise<User | AuthenticatedUser> {
  const user = await requireUser('/admin')
  if (isE2EMode()) {
    if (!('role' in user) || user.role !== 'admin') redirect('/403')
    return user
  }
  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error || profile?.role !== 'admin') {
    redirect('/403')
  }

  return user
}
