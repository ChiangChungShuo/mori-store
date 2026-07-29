import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteFooter } from '@/components/site-footer'

describe('SiteFooter', () => {
  it('places the compact brand beside the growth statement and preserves service navigation', () => {
    const { container } = render(<SiteFooter />)
    const lockup = container.querySelector('.footer-brand-lockup')
    expect(lockup).not.toBeNull()
    expect(lockup?.querySelector('.brand')).not.toBeNull()
    expect(lockup?.querySelector('.footer-brand-copy h2')).toHaveTextContent('把舒服穿進每一天的成長。')
    expect(screen.getByRole('navigation', { name: '購物指南' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '會員服務' })).toBeInTheDocument()
  })
})
