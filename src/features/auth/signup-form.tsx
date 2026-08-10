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

const initialContactState: SignupContactState = { ok: false }
const initialOtpState: SignupOtpState = { ok: false }
const initialPasswordState: SignupPasswordState = { ok: false }

export function SignupForm({
  nextPath,
  fixtureMode = false,
  welcomeGift,
}: {
  nextPath?: string
  fixtureMode?: boolean
  /** Shown before signing up: the reason to create an account at all. */
  welcomeGift?: { amount: number; minimumSpend: number } | null
}) {
  const [verificationOpen, setVerificationOpen] = useState(false)
  const [registration, setRegistration] = useState({
    displayName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    consent: false,
    marketingConsent: false,
  })
  const [verifiedContact, setVerifiedContact] = useState({
    displayName: '',
    email: '',
    phone: '',
    marketingConsent: false,
    maskedEmail: '',
    resendAvailableAt: 0,
  })
  const [completionState, setCompletionState] = useState(initialPasswordState)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const verificationHeadingRef = useRef<HTMLHeadingElement>(null)
  const touch = (field: string) => setTouched((current) => ({ ...current, [field]: true }))

  const [contactState, contactAction, contactPending] = useActionState(
    async (_previous: SignupContactState, formData: FormData) => {
      const result = await requestSignupOtp(formData)
      if (result.ok && result.email && result.phone) {
        const resendAvailableAt = result.resendAvailableAt ?? Date.now() + 60_000
        setVerifiedContact({
          displayName: result.displayName ?? registration.displayName.trim(),
          email: result.email,
          phone: result.phone,
          marketingConsent: result.marketingConsent ?? registration.marketingConsent,
          maskedEmail: result.maskedEmail ?? result.email,
          resendAvailableAt,
        })
        setRemainingSeconds(Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000)))
        setVerificationOpen(true)
      }
      return result
    },
    initialContactState,
  )
  const [otpState, otpAction, otpPending] = useActionState(
    async (_previous: SignupOtpState, formData: FormData) => {
      const result = await verifySignupOtp(formData)
      if (!result.ok || !result.verified) return result

      const completionData = new FormData()
      completionData.set('email', verifiedContact.email)
      completionData.set('password', registration.password)
      completionData.set('confirmPassword', registration.confirmPassword)
      if (nextPath) completionData.set('next', nextPath)
      const completion = await completeSignup(completionData)
      setCompletionState(completion)
      if (!completion.ok) setVerificationOpen(false)
      return result
    },
    initialOtpState,
  )
  const otpInputRef = useRef<HTMLInputElement>(null)

  async function pasteOtp() {
    try {
      const text = await navigator.clipboard.readText()
      const digits = text.replace(/\D/g, '').slice(0, 10)
      if (digits && otpInputRef.current) {
        otpInputRef.current.value = digits
        otpInputRef.current.focus()
      }
    } catch {
      otpInputRef.current?.focus()
    }
  }

  useEffect(() => {
    if (verificationOpen) verificationHeadingRef.current?.focus()
  }, [verificationOpen])

  useEffect(() => {
    if (!verificationOpen) return
    function updateRemaining() {
      setRemainingSeconds(Math.max(
        0,
        Math.ceil((verifiedContact.resendAvailableAt - Date.now()) / 1000),
      ))
    }
    const timer = window.setInterval(updateRemaining, 1000)
    return () => window.clearInterval(timer)
  }, [verificationOpen, verifiedContact.resendAvailableAt])

  const normalizedPhone = normalizeTaiwanMobile(registration.phone)
  const passwordValid = registration.password.length >= 8
    && registration.password === registration.confirmPassword
  const registrationValid = registration.displayName.trim().length >= 2
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registration.email.trim())
    && /^09\d{8}$/.test(normalizedPhone)
    && passwordValid
    && registration.consent

  // Client-side 防呆 hints so the shopper knows exactly what to fix before the button enables.
  const clientErrors: Record<string, string> = {
    displayName: registration.displayName.trim().length < 2 ? '請輸入至少 2 個字的真實姓名。' : '',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registration.email.trim()) ? '' : '請輸入有效的 Email，例如 name@example.com。',
    phone: /^09\d{8}$/.test(normalizedPhone) ? '' : '請輸入有效的台灣手機號碼（09 開頭、共 10 碼）。',
    password: registration.password.length < 8 ? '密碼至少需要 8 個字元。' : '',
    confirmPassword: registration.confirmPassword.length > 0 && registration.password !== registration.confirmPassword ? '兩次輸入的密碼不一致。' : '',
  }
  const fieldError = (field: string) => (touched[field] ? clientErrors[field] : '')

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

        <form action={contactAction} noValidate>
          <p className="eyebrow">member account</p>
          <h1>註冊會員</h1>
          <p className="auth-intro">一次填好會員資料與密碼，再到 Email 收取驗證碼。</p>
          {nextPath && <input name="next" type="hidden" value={nextPath} />}
          <fieldset className="signup-details" disabled={verificationOpen}>
            <div className="auth-field">
              <label htmlFor="signup-name">真實姓名 <span aria-hidden="true">＊</span></label>
              <input
                aria-describedby={contactState.fieldErrors?.displayName ? 'signup-name-help signup-name-error' : 'signup-name-help'}
                autoComplete="name"
                id="signup-name"
                name="displayName"
                onBlur={() => touch('displayName')}
                onChange={(event) => setRegistration((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="請輸入取貨人的真實姓名"
                value={registration.displayName}
              />
              <p className="field-help" id="signup-name-help">姓名會套用於取貨資料，請務必填寫正確。</p>
              {fieldError('displayName') && <p className="field-error" role="alert">{fieldError('displayName')}</p>}
              {contactState.fieldErrors?.displayName && <p id="signup-name-error" role="alert">{contactState.fieldErrors.displayName[0]}</p>}
            </div>
            <div className="auth-field">
              <label htmlFor="signup-email">Email</label>
              <input
                aria-describedby={contactState.fieldErrors?.email ? 'signup-email-error' : undefined}
                autoComplete="email"
                id="signup-email"
                inputMode="email"
                name="email"
                onBlur={() => touch('email')}
                onChange={(event) => setRegistration((current) => ({ ...current, email: event.target.value }))}
                placeholder="請輸入常用 Email"
                type="email"
                value={registration.email}
              />
              {fieldError('email') && <p className="field-error" role="alert">{fieldError('email')}</p>}
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
                onBlur={() => touch('phone')}
                onChange={(event) => setRegistration((current) => ({ ...current, phone: event.target.value }))}
                placeholder="例如：0912 345 678"
                type="tel"
                value={registration.phone}
              />
              <p className="field-help" id="signup-phone-help">僅作為會員與訂單聯絡資料，不會發送簡訊。</p>
              {fieldError('phone') && <p className="field-error" role="alert">{fieldError('phone')}</p>}
              {contactState.fieldErrors?.phone && <p id="signup-phone-error" role="alert">{contactState.fieldErrors.phone[0]}</p>}
            </div>
            <div className="auth-field">
              <label htmlFor="signup-password">設定密碼</label>
              <div className="password-field">
                <input
                  aria-describedby={completionState.fieldErrors?.password ? 'signup-password-help signup-password-error' : 'signup-password-help'}
                  autoComplete="new-password"
                  id="signup-password"
                  minLength={8}
                  name="password"
                  onBlur={() => touch('password')}
                  onChange={(event) => setRegistration((current) => ({ ...current, password: event.target.value }))}
                  placeholder="請設定至少 8 個字元的密碼"
                  type={showPassword ? 'text' : 'password'}
                  value={registration.password}
                />
                <button aria-label={showPassword ? '隱藏密碼' : '顯示密碼'} onClick={() => setShowPassword((shown) => !shown)} type="button">{showPassword ? '隱藏' : '顯示'}</button>
              </div>
              <p className="field-help" id="signup-password-help">密碼至少需要 8 個字元</p>
              {fieldError('password') && <p className="field-error" role="alert">{fieldError('password')}</p>}
              {completionState.fieldErrors?.password && <p id="signup-password-error" role="alert">{completionState.fieldErrors.password[0]}</p>}
            </div>
            <div className="auth-field">
              <label htmlFor="signup-confirm-password">確認密碼</label>
              <input
                aria-describedby={completionState.fieldErrors?.confirmPassword ? 'signup-confirm-password-error' : undefined}
                autoComplete="new-password"
                id="signup-confirm-password"
                minLength={8}
                name="confirmPassword"
                onBlur={() => touch('confirmPassword')}
                onChange={(event) => setRegistration((current) => ({ ...current, confirmPassword: event.target.value }))}
                placeholder="請再次輸入密碼"
                type={showPassword ? 'text' : 'password'}
                value={registration.confirmPassword}
              />
              {fieldError('confirmPassword') && <p className="field-error" role="alert">{fieldError('confirmPassword')}</p>}
              {completionState.fieldErrors?.confirmPassword && <p id="signup-confirm-password-error" role="alert">{completionState.fieldErrors.confirmPassword[0]}</p>}
            </div>
            <label className="auth-consent-check auth-marketing-check">
              <input
                checked={registration.marketingConsent}
                name="marketingConsent"
                onChange={(event) => setRegistration((current) => ({ ...current, marketingConsent: event.target.checked }))}
                type="checkbox"
              />
              <span>我願意接收新品、優惠與活動消息（選填）</span>
            </label>
            <label className="auth-consent-check">
              <input
                checked={registration.consent}
                name="consent"
                onChange={(event) => setRegistration((current) => ({ ...current, consent: event.target.checked }))}
                type="checkbox"
              />
              <span>我已閱讀並同意 <Link href="/terms">服務條款</Link> 與 <Link href="/privacy">隱私權政策</Link></span>
            </label>
          </fieldset>
          {contactState.fieldErrors?.consent && <p className="auth-error" role="alert">{contactState.fieldErrors.consent[0]}</p>}
          {contactState.message && <p className="auth-error" role="status">{contactState.message}</p>}
          {completionState.message && <p className="auth-error" role="status">{completionState.message}</p>}
          {!verificationOpen && !registrationValid && (
            <p className="signup-submit-hint" role="status">請完整填寫上方欄位，並勾選同意服務條款後，即可寄送驗證碼。</p>
          )}
          {!verificationOpen && (
            <button className="button button-wide" disabled={!registrationValid || contactPending} type="submit">
              {contactPending ? '寄送中…' : '寄送 Email 驗證碼'}
            </button>
          )}
        </form>

        {verificationOpen && (
          <section className="signup-verification-panel">
            <form action={otpAction} noValidate>
              <p className="eyebrow">Email verification</p>
              <h2 ref={verificationHeadingRef} tabIndex={-1}>驗證 Email</h2>
              <p>驗證碼已寄到 <strong>{verifiedContact.maskedEmail}</strong></p>
              <input name="email" type="hidden" value={verifiedContact.email} />
              <div className="auth-field">
                <label htmlFor="signup-otp">Email 驗證碼</label>
                <div className="signup-otp-input-row">
                  <input
                    ref={otpInputRef}
                    aria-describedby={otpState.fieldErrors?.token || otpState.message ? 'signup-otp-error' : undefined}
                    autoComplete="one-time-code"
                    id="signup-otp"
                    inputMode="numeric"
                    maxLength={10}
                    name="token"
                    pattern="[0-9]{6,10}"
                    placeholder="請輸入信件中的驗證碼"
                  />
                  <button type="button" className="signup-otp-paste" onClick={pasteOtp}>貼上</button>
                </div>
                {(otpState.fieldErrors?.token || otpState.message) && (
                  <p id="signup-otp-error" role="alert">{otpState.fieldErrors?.token?.[0] ?? otpState.message}</p>
                )}
              </div>
              {fixtureMode && <p className="signup-fixture-code">本機驗證碼：123456</p>}
              <button className="button button-wide" disabled={otpPending} type="submit">
                {otpPending ? '建立中…' : '驗證並建立帳號'}
              </button>
            </form>
            <div className="signup-otp-actions">
              <form action={contactAction}>
                <input name="email" type="hidden" value={verifiedContact.email} />
                <input name="phone" type="hidden" value={verifiedContact.phone} />
                <input name="displayName" type="hidden" value={verifiedContact.displayName} />
                <input name="consent" type="hidden" value="on" />
                {verifiedContact.marketingConsent && <input name="marketingConsent" type="hidden" value="on" />}
                <button disabled={remainingSeconds > 0 || contactPending} type="submit">
                  {remainingSeconds > 0 ? `重新寄送（${remainingSeconds} 秒）` : '重新寄送'}
                </button>
              </form>
              <button onClick={() => setVerificationOpen(false)} type="button">修改會員資料</button>
            </div>
          </section>
        )}

        <p className="auth-switch">已經有帳號？ <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'}>前往登入</Link></p>
      </section>

      <section className="auth-story" aria-label="mori 會員服務">
        {welcomeGift ? (
          <aside className="welcome-gift" data-variant="invite">
            <p className="welcome-gift-label">新會員禮</p>
            <strong>註冊就送 NT${welcomeGift.amount.toLocaleString('zh-TW')} 購物金</strong>
            <p>註冊完成後直接存進你的會員帳戶，下次結帳自動折抵，不用輸入優惠碼。</p>
          </aside>
        ) : null}
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
