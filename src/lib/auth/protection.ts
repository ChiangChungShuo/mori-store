type Profile = { role: string }

export function safeNextPath(value: string | null | undefined): string | null {
  if (!value?.startsWith('/') || value.startsWith('//')) {
    return null
  }

  try {
    let decodedValue = value

    for (let index = 0; index < 4 && /%[0-9a-f]{2}/i.test(decodedValue); index += 1) {
      decodedValue = decodeURIComponent(decodedValue)
    }

    if (
      value.includes('\\')
      || /%[0-9a-f]{2}/i.test(decodedValue)
      || decodedValue.startsWith('//')
      || decodedValue.startsWith('/\\')
    ) {
      return null
    }
  } catch {
    return null
  }

  return value
}

export function resolveProtectedDestination(profile: Profile | null, destination: string): string | null {
  const safeDestination = safeNextPath(destination)

  if (!safeDestination) {
    return profile ? '/403' : '/login'
  }

  if (!profile) {
    return `/login?next=${encodeURIComponent(safeDestination)}`
  }

  if ((safeDestination === '/admin' || safeDestination.startsWith('/admin/')) && profile.role !== 'admin') {
    return '/403'
  }

  return null
}
