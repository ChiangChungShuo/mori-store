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

function fillRegistration() {
  fireEvent.change(screen.getByLabelText(/真實姓名/), {
    target: { value: '王小美' },
  })
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'parent@example.com' },
  })
  fireEvent.change(screen.getByLabelText('手機號碼'), {
    target: { value: '0912345678' },
  })
  fireEvent.change(screen.getByLabelText('設定密碼'), {
    target: { value: 'mori-parent-123' },
  })
  fireEvent.change(screen.getByLabelText('確認密碼'), {
    target: { value: 'mori-parent-123' },
  })
  fireEvent.click(screen.getByLabelText(/我已閱讀並同意/))
}

describe('Email OTP signup form', () => {
  it('requires valid contact data and legal consent before continuing', () => {
    render(<SignupForm />)

    expect(screen.getByRole('heading', { name: '註冊會員' })).toBeInTheDocument()
    expect(screen.getByLabelText(/真實姓名/)).toHaveAttribute('autocomplete', 'name')
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Email')).toHaveAttribute('placeholder', '請輸入常用 Email')
    expect(screen.getByLabelText('手機號碼')).toHaveAttribute('autocomplete', 'tel')
    expect(screen.getByLabelText('手機號碼')).toHaveAttribute('placeholder', '例如：0912 345 678')
    expect(screen.getByLabelText('設定密碼')).toHaveAttribute('placeholder', '請設定至少 8 個字元的密碼')
    expect(screen.getByLabelText('確認密碼')).toHaveAttribute('placeholder', '請再次輸入密碼')
    expect(screen.getByRole('link', { name: '服務條款' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: '隱私權政策' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByLabelText(/接收新品、優惠與活動消息/)).not.toBeChecked()
    expect(screen.queryByLabelText('註冊進度')).not.toBeInTheDocument()
    expect(screen.getByLabelText('設定密碼')).toHaveAttribute('minlength', '8')
    expect(screen.getByLabelText('確認密碼')).toHaveAttribute('minlength', '8')
    expect(screen.getByLabelText('設定密碼')).not.toHaveAttribute('maxlength')
    expect(screen.getByRole('button', { name: '寄送 Email 驗證碼' })).toBeDisabled()

    fillRegistration()
    expect(screen.getByRole('button', { name: '寄送 Email 驗證碼' })).toBeEnabled()
  })

  it('keeps registration data on one page and creates the account after Email verification', async () => {
    signupMocks.requestSignupOtp.mockResolvedValueOnce({
      ok: true,
      email: 'parent@example.com',
      phone: '0912345678',
      maskedEmail: 'pa***@example.com',
      resendAvailableAt: Date.now() + 60_000,
    })
    signupMocks.verifySignupOtp.mockResolvedValueOnce({ ok: true, verified: true })
    signupMocks.completeSignup.mockResolvedValueOnce({ ok: true })
    render(<SignupForm fixtureMode />)

    fillRegistration()
    fireEvent.submit(screen.getByRole('button', { name: '寄送 Email 驗證碼' }).closest('form')!)

    expect(await screen.findByRole('heading', { name: '驗證 Email' })).toBeInTheDocument()
    expect(screen.getByText(/pa\*\*\*@example\.com/)).toBeInTheDocument()
    expect(screen.getByLabelText('設定密碼')).toBeInTheDocument()
    expect(screen.getByLabelText('Email 驗證碼')).toHaveAttribute('inputmode', 'numeric')
    expect(screen.getByLabelText('Email 驗證碼')).toHaveAttribute('placeholder', '請輸入信件中的驗證碼')
    expect(screen.getByText('本機驗證碼：123456')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /重新寄送/ })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Email 驗證碼'), { target: { value: '123456' } })
    fireEvent.submit(screen.getByRole('button', { name: '驗證並建立帳號' }).closest('form')!)

    await waitFor(() => expect(signupMocks.completeSignup).toHaveBeenCalledOnce())
    const completion = signupMocks.completeSignup.mock.calls[0][0] as FormData
    expect(completion.get('password')).toBe('mori-parent-123')
    expect(completion.get('confirmPassword')).toBe('mori-parent-123')
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

    fillRegistration()
    fireEvent.submit(screen.getByRole('button', { name: '寄送 Email 驗證碼' }).closest('form')!)

    await waitFor(() => expect(screen.getByLabelText('Email 驗證碼')).toBeInTheDocument())
    expect(screen.queryByText('本機驗證碼：123456')).not.toBeInTheDocument()
  })
})
