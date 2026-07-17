import { z } from 'zod'

export const checkoutSchema = z.object({
  email: z.string().trim().email('請輸入有效的 Email').transform((value) => value.toLowerCase()),
  recipientName: z.string().trim().min(1, '請輸入收件人姓名'),
  phone: z.string().trim().regex(/^09\d{8}$/, '請輸入有效的台灣手機號碼'),
  chain: z.enum(['seven_eleven', 'family_mart']),
  storeId: z.string().trim().min(1, '請選擇門市'),
  storeName: z.string().trim().min(1, '請選擇門市'),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>

export const testPaymentRequestSchema = z.object({
  attemptId: z.string().uuid(),
  outcome: z.enum(['success', 'failure', 'cancelled']),
}).strict()
