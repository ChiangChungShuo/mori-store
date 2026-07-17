import { NextRequest } from 'next/server'
import { safeNextPath } from '@/lib/auth/protection'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const nextPath = safeNextPath(request.nextUrl.searchParams.get('next')) ?? '/account'

  if (!code) {
    return Response.redirect(new URL('/login', request.url))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return Response.redirect(new URL('/login', request.url))
  }

  return Response.redirect(new URL(nextPath, request.url))
}
