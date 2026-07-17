import { completeTestPayment } from '@/features/checkout/test-payment'
import { testPaymentRequestSchema } from '@/lib/validation/checkout'

export async function POST(request: Request) {
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
