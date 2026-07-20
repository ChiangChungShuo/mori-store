import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthForm } from '@/features/auth/auth-form'

const authActionMocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('@/features/auth/actions', () => ({
  signIn: authActionMocks.signIn,
  signUp: authActionMocks.signUp,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('member auth form', () => {
  it('shows the complete sign-in card, password control and local owner guidance', () => {
    render(<AuthForm fixtureMode mode="sign-in" />)

    expect(screen.getByRole('heading', { name: '歡迎回到 mori' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('密碼')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('密碼')).not.toHaveAttribute('aria-describedby')
    fireEvent.click(screen.getByRole('button', { name: '顯示密碼' }))
    expect(screen.getByLabelText('密碼')).toHaveAttribute('type', 'text')
    expect(screen.getByText('本機老闆示範帳號')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '建立會員帳號' })).toHaveAttribute('href', '/signup')
  })

  it('explains registration requirements without exposing owner credentials in live mode', () => {
    render(<AuthForm mode="sign-up" />)

    expect(screen.getByRole('heading', { name: '建立你的 mori 帳號' })).toBeInTheDocument()
    expect(screen.getByText('至少 8 個字元')).toBeInTheDocument()
    expect(screen.getByLabelText('密碼')).toHaveAttribute('aria-describedby', 'password-help')
    expect(screen.queryByText('本機老闆示範帳號')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '前往登入' })).toHaveAttribute('href', '/login')
  })

  it('keeps password help and error associated after sign-up validation fails', async () => {
    authActionMocks.signUp.mockResolvedValueOnce({
      ok: false,
      fieldErrors: { password: ['密碼至少需要 8 個字元。'] },
    })
    render(<AuthForm mode="sign-up" />)

    fireEvent.submit(screen.getByRole('button', { name: '建立會員帳號' }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByLabelText('密碼'))
        .toHaveAttribute('aria-describedby', 'password-help password-error')
    })
  })

  it('associates only the password error after sign-in validation fails', async () => {
    authActionMocks.signIn.mockResolvedValueOnce({
      ok: false,
      fieldErrors: { password: ['密碼至少需要 8 個字元。'] },
    })
    render(<AuthForm mode="sign-in" />)

    fireEvent.submit(screen.getByRole('button', { name: '登入' }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByLabelText('密碼')).toHaveAttribute('aria-describedby', 'password-error')
    })
  })

  it('disables and relabels the submit button while authentication is pending', async () => {
    let resolveAction!: (state: { ok: boolean }) => void
    authActionMocks.signIn.mockReturnValueOnce(new Promise((resolve) => {
      resolveAction = resolve
    }))
    render(<AuthForm mode="sign-in" />)

    fireEvent.submit(screen.getByRole('button', { name: '登入' }).closest('form')!)

    const pendingButton = await screen.findByRole('button', { name: '處理中…' })
    expect(pendingButton).toBeDisabled()
    expect(pendingButton).toHaveClass('button', 'button-wide')

    await act(async () => resolveAction({ ok: false }))
    await waitFor(() => expect(screen.getByRole('button', { name: '登入' })).toBeEnabled())
  })

  it('hides local owner credentials on live sign-in', () => {
    render(<AuthForm mode="sign-in" />)

    expect(screen.queryByText('本機老闆示範帳號')).not.toBeInTheDocument()
  })

  it('preserves a safe next path through sign-in and the registration link', () => {
    const { container } = render(<AuthForm mode="sign-in" nextPath="/account/orders" />)

    expect(container.querySelector('input[type="hidden"][name="next"]'))
      .toHaveValue('/account/orders')
    expect(screen.getByRole('link', { name: '建立會員帳號' }))
      .toHaveAttribute('href', '/signup?next=%2Faccount%2Forders')
  })

  it('preserves a safe next path through sign-up and the login link', () => {
    const { container } = render(<AuthForm mode="sign-up" nextPath="/account/orders" />)

    expect(container.querySelector('input[type="hidden"][name="next"]'))
      .toHaveValue('/account/orders')
    expect(screen.getByRole('link', { name: '前往登入' }))
      .toHaveAttribute('href', '/login?next=%2Faccount%2Forders')
  })

  it('keeps the form first in the DOM for the mobile reading order', () => {
    const { container } = render(<AuthForm mode="sign-in" />)
    const form = container.querySelector('.auth-card')
    const story = container.querySelector('.auth-story')

    expect(form).not.toBeNull()
    expect(story).not.toBeNull()
    expect(form!.compareDocumentPosition(story!) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy()
  })
})
