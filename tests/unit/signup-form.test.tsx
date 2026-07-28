import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SignupForm } from '@/features/auth/signup-form'

const signupMocks = vi.hoisted(() => ({
  requestSignupOtp: vi.fn(),
  verifySignupOtp: vi.fn(),
  completeSignup: vi.fn(),
}))

vi.mock('@/features/auth/signup-actions', () => signupMocks)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function fillContact() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'parent@example.com' },
  })
  fireEvent.change(screen.getByLabelText('手機號碼'), {
    target: { value: '0912345678' },
  })
  fireEvent.click(screen.getByLabelText(/我已閱讀並同意/))
}

describe('Email OTP signup form', () => {
  it('requires valid contact data and legal consent before continuing', () => {
    render(<SignupForm />)

    expect(screen.getByRole('heading', { name: '註冊會員' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('手機號碼')).toHaveAttribute('autocomplete', 'tel')
    expect(screen.getByRole('link', { name: '服務條款' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: '隱私權政策' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled()

    fillContact()
    expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled()
  })

  it('moves from masked Email OTP verification to password setup', async () => {
    signupMocks.requestSignupOtp.mockResolvedValueOnce({
      ok: true,
      email: 'parent@example.com',
      phone: '0912345678',
      maskedEmail: 'pa***@example.com',
      resendAvailableAt: Date.now() + 60_000,
    })
    signupMocks.verifySignupOtp.mockResolvedValueOnce({ ok: true, verified: true })
    render(<SignupForm fixtureMode />)

    fillContact()
    fireEvent.submit(screen.getByRole('button', { name: '下一步' }).closest('form')!)

    expect(await screen.findByRole('heading', { name: '輸入 Email 驗證碼' })).toBeInTheDocument()
    expect(screen.getByText(/pa\*\*\*@example\.com/)).toBeInTheDocument()
    expect(screen.getByLabelText('Email 驗證碼')).toHaveAttribute('inputmode', 'numeric')
    expect(screen.getByText('本機驗證碼：123456')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /重新寄送/ })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Email 驗證碼'), { target: { value: '123456' } })
    fireEvent.submit(screen.getByRole('button', { name: '驗證 Email' }).closest('form')!)

    expect(await screen.findByRole('heading', { name: '設定會員密碼' })).toBeInTheDocument()
    expect(screen.getByLabelText('設定密碼')).toHaveAttribute('minlength', '8')
    expect(screen.getByRole('button', { name: '完成註冊' })).toBeInTheDocument()
  })

  it('does not expose the fixture OTP in live mode', async () => {
    signupMocks.requestSignupOtp.mockResolvedValueOnce({
      ok: true,
      email: 'parent@example.com',
      phone: '0912345678',
      maskedEmail: 'pa***@example.com',
      resendAvailableAt: Date.now() + 60_000,
    })
    render(<SignupForm />)

    fillContact()
    fireEvent.submit(screen.getByRole('button', { name: '下一步' }).closest('form')!)

    await waitFor(() => expect(screen.getByLabelText('Email 驗證碼')).toBeInTheDocument())
    expect(screen.queryByText('本機驗證碼：123456')).not.toBeInTheDocument()
  })
})
