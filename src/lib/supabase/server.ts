import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

type ServerClientOptions = {
  sessionMaxAge?: number | null
}

function sessionCookieOptions<T extends Record<string, unknown>>(
  options: T,
  maxAge: number | null | undefined,
) {
  if (maxAge === undefined) return options
  if (maxAge !== null) return { ...options, maxAge }
  const sessionOptions = { ...options }
  delete sessionOptions.maxAge
  return sessionOptions
}

export async function createClient(options: ServerClientOptions = {}) {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
              cookieStore.set(
                name,
                value,
                sessionCookieOptions(cookieOptions, options.sessionMaxAge),
              )
            })
          } catch {
            // Server Components cannot write cookies; proxy.ts refreshes them instead.
          }
        },
      },
    },
  )
}
