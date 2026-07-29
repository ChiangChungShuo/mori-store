import Link from 'next/link'

const steps = ['購物車', '填寫資料', '訂單確認'] as const
const previousSteps = {
  1: { href: '/products', label: '繼續選購商品' },
  2: { href: '/cart', label: '返回購物車' },
  3: { href: '/checkout', label: '返回修改資料' },
} as const

export function CheckoutProgress({ current }: { current: 1 | 2 | 3 }) {
  const previous = previousSteps[current]
  return (
    <div className="checkout-progress-wrap">
      <Link className="checkout-progress-back" href={previous.href}>← {previous.label}</Link>
      <nav className="checkout-progress" aria-label="結帳進度">
        <ol>
          {steps.map((label, index) => {
            const step = index + 1
            const state = step < current ? 'complete' : step === current ? 'current' : 'upcoming'
            return (
              <li aria-current={state === 'current' ? 'step' : undefined} data-state={state} key={label}>
                <span>{String(step).padStart(2, '0')}</span>
                <strong>{label}</strong>
              </li>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}
