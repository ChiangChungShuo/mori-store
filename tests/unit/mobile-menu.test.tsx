import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import Link from 'next/link'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MobileMenu } from '@/components/mobile-menu'

afterEach(cleanup)

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

function renderMenu() {
  render(
    <MobileMenu ariaLabel="主要導覽" heading="選單" id="test-menu">
      <Link href="/products" onClick={(event) => event.preventDefault()}>所有商品</Link>
    </MobileMenu>,
  )
  return {
    dialog: screen.getByLabelText('主要導覽', { selector: 'dialog' }),
    trigger: screen.getByRole('button', { name: '開啟選單' }),
  }
}

describe('MobileMenu', () => {
  it('opens and closes with Escape while restoring trigger focus', () => {
    const { dialog, trigger } = renderMenu()
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(dialog).toHaveAttribute('open')

    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  it.each([
    ['close button', () => within(screen.getByLabelText('主要導覽', { selector: 'dialog' })).getByRole('button', { name: '關閉選單' })],
    ['child link', () => screen.getByRole('link', { name: '所有商品' })],
  ])('closes from the %s', (_label, findTarget) => {
    const { dialog, trigger } = renderMenu()
    fireEvent.click(trigger)
    fireEvent.click(findTarget())
    expect(dialog).not.toHaveAttribute('open')
    expect(trigger).toHaveFocus()
  })

  it('closes when the dialog backdrop receives the click', () => {
    const { dialog, trigger } = renderMenu()
    fireEvent.click(trigger)
    fireEvent.click(dialog)
    expect(dialog).not.toHaveAttribute('open')
    expect(trigger).toHaveFocus()
  })
})
