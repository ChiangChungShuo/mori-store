import type { NextRequest } from 'next/server'
import { completeTestPayment } from '@/features/checkout/test-payment'
import { testPaymentRequestSchema } from '@/lib/validation/checkout'

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  // This browser-only endpoint rejects missing Origin; server/form callers use the server service.
  if (!origin) {
    return Response.json({ error: '不允許的付款來源' }, { status: 403 })
  }

  try {
    const originUrl = new URL(origin)
    const requestHost = request.headers.get('x-forwarded-host')?.split(',', 1)[0].trim()
      || request.headers.get('host')
      || request.nextUrl.host
    const requestProtocol = request.headers.get('x-forwarded-proto')?.split(',', 1)[0].trim()
      || request.nextUrl.protocol.slice(0, -1)

    if (originUrl.host !== requestHost || originUrl.protocol !== `${requestProtocol}:`) {
      return Response.json({ error: '不允許的付款來源' }, { status: 403 })
    }
  } catch {
    return Response.json({ error: '不允許的付款來源' }, { status: 403 })
  }

  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') {
    return Response.json({ error: '付款請求必須使用 JSON' }, { status: 415 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '付款請求格式錯誤' }, { status: 400 })
  }

  const parsed = testPaymentRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: '付款請求格式錯誤' }, { status: 400 })
  }

  try {
    return Response.json(await completeTestPayment(parsed.data.attemptId, parsed.data.outcome))
  } catch {
    return Response.json({ error: '目前無法處理付款結果，請稍後再試' }, { status: 409 })
  }
}
