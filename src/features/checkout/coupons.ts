import { isE2EMode } from '@/testing/e2e-mode'

export type CouponValidation = {
  ok: boolean
  code: string
  discount: number
  message: string
}

type CouponRule = { conditionValue: number; rewardValue: number }

function evaluateCoupon(code: string, subtotal: number, promotion: CouponRule): CouponValidation {
  if (subtotal < promotion.conditionValue) {
    return {
      ok: false,
      code,
      discount: 0,
      message: `此優惠碼需消費滿 NT$${promotion.conditionValue.toLocaleString('zh-TW')}。`,
    }
  }

  const discount = Math.min(promotion.rewardValue, subtotal)
  return {
    ok: true,
    code,
    discount,
    message: `已套用 ${code}，折抵 NT$${discount.toLocaleString('zh-TW')}。`,
  }
}

export async function validateCoupon(codeInput: string, subtotal: number): Promise<CouponValidation> {
  const code = codeInput.trim().toUpperCase()
  if (!code) return { ok: false, code, discount: 0, message: '請輸入優惠碼。' }

  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const promotion = getE2EStore().promotions.find((candidate) => (
      candidate.active && candidate.type === 'coupon' && candidate.code === code
    ))
    if (!promotion) return { ok: false, code, discount: 0, message: '找不到此優惠碼，請確認後再試。' }
    return evaluateCoupon(code, subtotal, promotion)
  }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { data, error } = await createAdminClient()
    .from('promotions')
    .select('condition_value, reward_value')
    .eq('type', 'coupon')
    .eq('active', true)
    .ilike('code', code)
    .maybeSingle()
  if (error || !data) return { ok: false, code, discount: 0, message: '找不到此優惠碼，請確認後再試。' }

  return evaluateCoupon(code, subtotal, {
    conditionValue: data.condition_value,
    rewardValue: data.reward_value,
  })
}
