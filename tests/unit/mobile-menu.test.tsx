import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import Link from 'next/link'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileMenu } from '@/components/mobile-menu'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as MediaQueryList))
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

  it('closes when the viewport changes to the desktop breakpoint', () => {
    let changeListener: EventListener | undefined
    const matchMedia = vi.fn((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        changeListener = listener as EventListener
      },
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as MediaQueryList)
    vi.stubGlobal('matchMedia', matchMedia)

    const { dialog, trigger } = renderMenu()
    fireEvent.click(trigger)
    expect(dialog).toHaveAttribute('open')
    expect(matchMedia).toHaveBeenCalledWith('(max-width: 58rem)')

    act(() => {
      changeListener?.(Object.assign(new Event('change'), { matches: false }))
    })

    expect(dialog).not.toHaveAttribute('open')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  it('uses a custom lifecycle breakpoint without changing the default', () => {
    const matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList)
    vi.stubGlobal('matchMedia', matchMedia)

    render(
      <MobileMenu ariaLabel="主要導覽" breakpoint="36rem" heading="選單" id="store-menu">
        <Link href="/products">所有商品</Link>
      </MobileMenu>,
    )

    expect(matchMedia).toHaveBeenCalledWith('(max-width: 36rem)')
  })

  it('exposes the requested drawer side without changing the default', () => {
    const { unmount } = render(
      <MobileMenu ariaLabel="主要導覽" heading="選單" id="left-menu" side="left">
        <Link href="/products">所有商品</Link>
      </MobileMenu>,
    )
    expect(screen.getByLabelText('主要導覽', { selector: 'dialog' }))
      .toHaveAttribute('data-side', 'left')

    unmount()
    render(
      <MobileMenu ariaLabel="後備導覽" heading="選單" id="default-menu">
        <Link href="/products">所有商品</Link>
      </MobileMenu>,
    )
    expect(screen.getByLabelText('後備導覽', { selector: 'dialog' }))
      .toHaveAttribute('data-side', 'right')
  })
})
