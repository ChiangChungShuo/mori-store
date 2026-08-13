import { z } from 'zod'

export const checkoutSchema = z.object({
  email: z.string().trim().email('請輸入有效的 Email').transform((value) => value.toLowerCase()),
  recipientName: z.string().trim().min(1, '請輸入收件人姓名'),
  phone: z.string().trim().regex(/^09\d{8}$/, '請輸入有效的台灣手機號碼'),
  chain: z.enum(['seven_eleven', 'family_mart'])
    .refine((chain) => chain === 'seven_eleven', '目前僅支援 7-ELEVEN 取貨'),
  storeName: z.string().trim().min(1, '請輸入取貨門市名稱').max(60, '門市名稱請控制在 60 字以內'),
  storeId: z.string().trim().min(1, '請輸入門市店號').max(20, '店號請控制在 20 字以內'),
  couponCode: z.string().trim().toUpperCase().max(32).optional(),
  customerNote: z.string().trim().max(500, '訂單留言不可超過 500 個字').optional(),
  // Only the manual methods the shop actually operates. `online_test` used to be
  // accepted here, which let a shopper edit the hidden field and route their
  // order through the test gateway — landing it in `paid` without paying.
  paymentMethod: z.literal('bank_transfer').optional(),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>

export const testPaymentRequestSchema = z.object({
  attemptId: z.string().uuid(),
  outcome: z.enum(['success', 'failure', 'cancelled']),
}).strict()

export const submitOrderRequestSchema = z.object({
  attemptId: z.string().uuid(),
}).strict()

export const bankTransferLastFiveSchema = z.string().trim().regex(/^\d{5}$/, '請輸入匯款帳號末 5 碼')
