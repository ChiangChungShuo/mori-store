import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isE2EMode } from '@/testing/e2e-mode'
import type { Database } from '@/types/database'

type ProxyEnvironment = {
  NODE_ENV?: string
  MORI_E2E_FIXTURES?: string
  NEXT_PUBLIC_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string
}

export function shouldBypassSessionRefresh(environment: ProxyEnvironment = process.env) {
  const missingCredentials = !environment.NEXT_PUBLIC_SUPABASE_URL
    || !environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  // isE2EMode checks MORI_E2E_FIXTURES and NODE_ENV !== 'production'.
  return isE2EMode(environment) && missingCredentials
}

export async function updateSession(request: NextRequest) {
  if (shouldBypassSessionRefresh()) return NextResponse.next({ request })

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: jwt } = await supabase.auth.getClaims()

  if (jwt?.claims) {
    response.headers.set('Cache-Control', 'private, no-store')
  }

  return response
}
