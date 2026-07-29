// @vitest-environment-options {"url":"http://192.168.1.240:3000/checkout"}

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StorePicker } from '@/features/checkout/store-picker'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('local network store picker', () => {
  it('uses an in-page demo picker instead of posting customer data from HTTPS back to HTTP', () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined)
    const onStoreNameChange = vi.fn()
    const onStoreIdChange = vi.fn()

    render(<StorePicker
      chain="family_mart"
      storeName=""
      storeId=""
      onChainChange={vi.fn()}
      onStoreNameChange={onStoreNameChange}
      onStoreIdChange={onStoreIdChange}
    />)

    fireEvent.click(screen.getByRole('button', { name: '開啟全家門市地圖' }))

    expect(submit).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: '選擇全家測試門市' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '選擇全家測試門市' }))
    expect(onStoreNameChange).toHaveBeenCalledWith('全家測試門市')
    expect(onStoreIdChange).toHaveBeenCalledWith('F00001')
  })
})
