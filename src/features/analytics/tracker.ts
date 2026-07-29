'use client'

import type { StorefrontEvent } from '@/features/analytics/insights'

const SESSION_KEY = 'mori-analytics-session-v1'

function createSessionId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function getSessionId() {
  let sessionId = window.sessionStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = createSessionId()
    window.sessionStorage.setItem(SESSION_KEY, sessionId)
  }
  return sessionId
}

export function trackStorefrontEvent(
  type: StorefrontEvent['type'],
  details: { productName?: string | null; path?: string; searchQuery?: string | null; resultCount?: number | null } = {},
) {
  const body = JSON.stringify({
    sessionId: getSessionId(),
    type,
    productName: details.productName ?? null,
    searchQuery: details.searchQuery ?? null,
    resultCount: details.resultCount ?? null,
    path: details.path ?? window.location.pathname,
  })

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/events', new Blob([body], { type: 'application/json' }))
    return
  }
  void fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined)
}
