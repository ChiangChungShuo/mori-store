import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProductGallery } from '@/features/catalog/product-gallery'

afterEach(cleanup)

describe('ProductGallery', () => {
  const images = [
    { url: '/front.jpg', alt: '商品正面' },
    { url: '/back.jpg', alt: '商品背面' },
  ]

  it('supports arrow navigation and an enlarged image view', () => {
    render(createElement(ProductGallery, { images, isNew: true }))

    expect(screen.getByRole('img', { name: '商品正面' })).toHaveAttribute('src', expect.stringContaining(encodeURIComponent('/front.jpg')))
    fireEvent.click(screen.getByRole('button', { name: '下一張商品圖片' }))
    expect(screen.getByRole('img', { name: '商品背面' })).toHaveAttribute('src', expect.stringContaining(encodeURIComponent('/back.jpg')))

    fireEvent.click(screen.getByRole('button', { name: '放大圖片' }))
    expect(screen.getByRole('dialog', { name: '商品圖片放大檢視' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '關閉放大圖片' }))
    expect(screen.queryByRole('dialog', { name: '商品圖片放大檢視' })).not.toBeInTheDocument()
  })
})
