import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthForm } from '@/features/auth/auth-form'

vi.mock('@/features/auth/actions', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}))

afterEach(cleanup)

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
    expect(screen.queryByText('本機老闆示範帳號')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '前往登入' })).toHaveAttribute('href', '/login')
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
