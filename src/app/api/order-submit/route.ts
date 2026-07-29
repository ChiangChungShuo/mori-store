import type { NextRequest } from 'next/server'
import { submitOrder } from '@/features/checkout/service'
import { submitOrderRequestSchema } from '@/lib/validation/checkout'

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return Response.json({ error: '不允許的訂單來源' }, { status: 403 })

  try {
    const originUrl = new URL(origin)
    const requestHost = request.headers.get('x-forwarded-host')?.split(',', 1)[0].trim()
      || request.headers.get('host') || request.nextUrl.host
    const protocol = request.headers.get('x-forwarded-proto')?.split(',', 1)[0].trim()
      || request.nextUrl.protocol.slice(0, -1)
    if (originUrl.host !== requestHost || originUrl.protocol !== `${protocol}:`) {
      return Response.json({ error: '不允許的訂單來源' }, { status: 403 })
    }
  } catch {
    return Response.json({ error: '不允許的訂單來源' }, { status: 403 })
  }

  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return Response.json({ error: '訂單請求必須使用 JSON' }, { status: 415 })
  }

  const parsed = submitOrderRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: '訂單請求格式錯誤' }, { status: 400 })

  try {
    return Response.json(await submitOrder(parsed.data.attemptId))
  } catch {
    return Response.json({ error: '商品資料或庫存已變更，請返回購物車確認' }, { status: 409 })
  }
}
