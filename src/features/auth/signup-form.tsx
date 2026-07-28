'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { BrandLogo } from '@/components/brand-logo'
import {
  normalizeTaiwanMobile,
  type SignupContactState,
  type SignupOtpState,
  type SignupPasswordState,
} from './signup-contract'
import {
  completeSignup,
  requestSignupOtp,
  verifySignupOtp,
} from './signup-actions'

type SignupStage = 'contact' | 'verify' | 'password'

const initialContactState: SignupContactState = { ok: false }
const initialOtpState: SignupOtpState = { ok: false }
const initialPasswordState: SignupPasswordState = { ok: false }

export function SignupForm({
  nextPath,
  fixtureMode = false,
}: {
  nextPath?: string
  fixtureMode?: boolean
}) {
  const [stage, setStage] = useState<SignupStage>('contact')
  const [contact, setContact] = useState({ email: '', phone: '', consent: false })
  const [verifiedContact, setVerifiedContact] = useState({
    email: '', phone: '', maskedEmail: '', resendAvailableAt: 0,
  })
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [contactState, contactAction, contactPending] = useActionState(
    async (_previous: SignupContactState, formData: FormData) => requestSignupOtp(formData),
    initialContactState,
  )
  const [otpState, otpAction, otpPending] = useActionState(
    async (_previous: SignupOtpState, formData: FormData) => verifySignupOtp(formData),
    initialOtpState,
  )
  const [passwordState, passwordAction, passwordPending] = useActionState(
    async (_previous: SignupPasswordState, formData: FormData) => completeSignup(formData),
    initialPasswordState,
  )

  useEffect(() => {
    if (!contactState.ok || !contactState.email || !contactState.phone) return
    setVerifiedContact({
      email: contactState.email,
      phone: contactState.phone,
      maskedEmail: contactState.maskedEmail ?? contactState.email,
      resendAvailableAt: contactState.resendAvailableAt ?? Date.now() + 60_000,
    })
    setStage('verify')
  }, [contactState])

  useEffect(() => {
    if (otpState.ok && otpState.verified) setStage('password')
  }, [otpState])

  useEffect(() => {
    headingRef.current?.focus()
  }, [stage])

  useEffect(() => {
    if (stage !== 'verify') return
    function updateRemaining() {
      setRemainingSeconds(Math.max(
        0,
        Math.ceil((verifiedContact.resendAvailableAt - Date.now()) / 1000),
      ))
    }
    updateRemaining()
    const timer = window.setInterval(updateRemaining, 1000)
    return () => window.clearInterval(timer)
  }, [stage, verifiedContact.resendAvailableAt])

  const normalizedPhone = normalizeTaiwanMobile(contact.phone)
  const contactValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())
    && /^09\d{8}$/.test(normalizedPhone)
    && contact.consent

  return (
    <main className="auth-shell signup-shell">
      <section className="auth-card signup-card">
        <div className="auth-topbar">
          <Link className="auth-home-link" href="/" aria-label="回到 mori 商城首頁">
            <span className="auth-home-mark"><BrandLogo /></span>
            <span>mori 商城</span>
          </Link>
          <Link className="auth-back-link" href="/products">先逛逛商品 →</Link>
        </div>

        <div className="signup-progress" aria-label="註冊進度">
          <span aria-current={stage === 'contact' ? 'step' : undefined}>1 資料</span>
          <span aria-current={stage === 'verify' ? 'step' : undefined}>2 驗證</span>
          <span aria-current={stage === 'password' ? 'step' : undefined}>3 密碼</span>
        </div>

        {stage === 'contact' && (
          <form action={contactAction} noValidate>
            <p className="eyebrow">member account</p>
            <h1 ref={headingRef} tabIndex={-1}>註冊會員</h1>
            <p className="auth-intro">留下聯絡資料，再到 Email 收取驗證碼。</p>
            {nextPath && <input name="next" type="hidden" value={nextPath} />}
            <div className="auth-field">
              <label htmlFor="signup-email">Email</label>
              <input
                aria-describedby={contactState.fieldErrors?.email ? 'signup-email-error' : undefined}
                autoComplete="email"
                id="signup-email"
                inputMode="email"
                name="email"
                onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))}
                type="email"
                value={contact.email}
              />
              {contactState.fieldErrors?.email && <p id="signup-email-error" role="alert">{contactState.fieldErrors.email[0]}</p>}
            </div>
            <div className="auth-field">
              <label htmlFor="signup-phone">手機號碼</label>
              <input
                aria-describedby={contactState.fieldErrors?.phone ? 'signup-phone-error' : 'signup-phone-help'}
                autoComplete="tel"
                id="signup-phone"
                inputMode="tel"
                name="phone"
                onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))}
                placeholder="0912345678"
                type="tel"
                value={contact.phone}
              />
              <p className="field-help" id="signup-phone-help">僅作為會員與訂單聯絡資料，不會發送簡訊。</p>
              {contactState.fieldErrors?.phone && <p id="signup-phone-error" role="alert">{contactState.fieldErrors.phone[0]}</p>}
            </div>
            <label className="auth-consent-check">
              <input
                checked={contact.consent}
                name="consent"
                onChange={(event) => setContact((current) => ({ ...current, consent: event.target.checked }))}
                type="checkbox"
              />
              <span>我已閱讀並同意 <Link href="/terms">服務條款</Link> 與 <Link href="/privacy">隱私權政策</Link></span>
            </label>
            {contactState.fieldErrors?.consent && <p className="auth-error" role="alert">{contactState.fieldErrors.consent[0]}</p>}
            {contactState.message && <p className="auth-error" role="status">{contactState.message}</p>}
            <button className="button button-wide" disabled={!contactValid || contactPending} type="submit">
              {contactPending ? '寄送中…' : '下一步'}
            </button>
          </form>
        )}

        {stage === 'verify' && (
          <div>
            <form action={otpAction} noValidate>
              <p className="eyebrow">verify your Email</p>
              <h1 ref={headingRef} tabIndex={-1}>輸入 Email 驗證碼</h1>
              <p className="auth-intro">驗證碼已寄到 <strong>{verifiedContact.maskedEmail}</strong></p>
              <input name="email" type="hidden" value={verifiedContact.email} />
              <div className="auth-field">
                <label htmlFor="signup-otp">Email 驗證碼</label>
                <input
                  aria-describedby={otpState.fieldErrors?.token || otpState.message ? 'signup-otp-error' : undefined}
                  autoComplete="one-time-code"
                  id="signup-otp"
                  inputMode="numeric"
                  maxLength={6}
                  name="token"
                  pattern="[0-9]{6}"
                />
                {(otpState.fieldErrors?.token || otpState.message) && (
                  <p id="signup-otp-error" role="alert">{otpState.fieldErrors?.token?.[0] ?? otpState.message}</p>
                )}
              </div>
              {fixtureMode && <p className="signup-fixture-code">本機驗證碼：123456</p>}
              <button className="button button-wide" disabled={otpPending} type="submit">
                {otpPending ? '驗證中…' : '驗證 Email'}
              </button>
            </form>
            <div className="signup-otp-actions">
              <form action={contactAction}>
                <input name="email" type="hidden" value={verifiedContact.email} />
                <input name="phone" type="hidden" value={verifiedContact.phone} />
                <input name="consent" type="hidden" value="on" />
                <button disabled={remainingSeconds > 0 || contactPending} type="submit">
                  {remainingSeconds > 0 ? `重新寄送（${remainingSeconds} 秒）` : '重新寄送'}
                </button>
              </form>
              <button onClick={() => setStage('contact')} type="button">修改 Email</button>
            </div>
          </div>
        )}

        {stage === 'password' && (
          <form action={passwordAction} noValidate>
            <p className="eyebrow">secure your account</p>
            <h1 ref={headingRef} tabIndex={-1}>設定會員密碼</h1>
            <p className="auth-intro">Email 驗證完成，設定之後登入使用的密碼。</p>
            <input name="email" type="hidden" value={verifiedContact.email} />
            {nextPath && <input name="next" type="hidden" value={nextPath} />}
            <div className="auth-field">
              <label htmlFor="signup-password">設定密碼</label>
              <input
                aria-describedby={passwordState.fieldErrors?.password ? 'signup-password-help signup-password-error' : 'signup-password-help'}
                autoComplete="new-password"
                id="signup-password"
                minLength={8}
                name="password"
                type="password"
              />
              <p className="field-help" id="signup-password-help">至少 8 個字元</p>
              {passwordState.fieldErrors?.password && <p id="signup-password-error" role="alert">{passwordState.fieldErrors.password[0]}</p>}
            </div>
            {passwordState.message && <p className="auth-error" role="status">{passwordState.message}</p>}
            <button className="button button-wide" disabled={passwordPending} type="submit">
              {passwordPending ? '建立中…' : '完成註冊'}
            </button>
          </form>
        )}

        <p className="auth-switch">已經有帳號？ <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'}>前往登入</Link></p>
      </section>

      <section className="auth-story" aria-label="mori 會員服務">
        <p className="eyebrow">mori members</p>
        <h2>陪孩子，把每天穿得舒服一點。</h2>
        <p>完成 Email 驗證後，即可查看訂單、取貨門市與付款狀態。</p>
        <ol className="size-track" aria-label="mori 適穿年齡">
          <li>0–2</li><li>3–5</li><li>6–9</li><li>10–12</li>
        </ol>
      </section>
    </main>
  )
}
