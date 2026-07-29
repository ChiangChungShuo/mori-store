import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MobileHeaderSearch } from '@/components/mobile-header-search'

afterEach(cleanup)

describe('MobileHeaderSearch', () => {
  it('opens into a focused search field and closes back to its trigger', () => {
    render(<MobileHeaderSearch />)
    const trigger = screen.getByRole('button', { name: '開啟商品搜尋' })
    fireEvent.click(trigger)

    const input = screen.getByRole('searchbox', { name: '搜尋商品' })
    expect(input).toHaveFocus()
    expect(screen.getByRole('search')).toHaveAttribute('action', '/products')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('searchbox', { name: '搜尋商品' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes from the explicit close control', () => {
    render(<MobileHeaderSearch />)
    const trigger = screen.getByRole('button', { name: '開啟商品搜尋' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: '關閉商品搜尋' }))
    expect(screen.queryByRole('searchbox', { name: '搜尋商品' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
