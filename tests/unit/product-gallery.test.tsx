import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProductGallery } from '@/features/catalog/product-gallery'
import { ProductColorProvider, useProductColor } from '@/features/catalog/product-color-context'

afterEach(cleanup)

describe('ProductGallery', () => {
  const images = [
    { url: '/front.jpg', alt: '商品正面', color: null },
    { url: '/back.jpg', alt: '商品背面', color: null },
  ]

  function renderGallery(galleryImages = images, initialColor = '藍色') {
    return render(createElement(ProductColorProvider, { initialColor },
      createElement(ProductGallery, { images: galleryImages, isNew: true }),
    ))
  }

  it('supports arrow navigation and an enlarged image view', () => {
    renderGallery()

    expect(screen.getByRole('img', { name: '商品正面' })).toHaveAttribute('src', expect.stringContaining(encodeURIComponent('/front.jpg')))
    fireEvent.click(screen.getByRole('button', { name: '下一張商品圖片' }))
    expect(screen.getByRole('img', { name: '商品背面' })).toHaveAttribute('src', expect.stringContaining(encodeURIComponent('/back.jpg')))

    fireEvent.click(screen.getByRole('button', { name: '放大圖片' }))
    expect(screen.getByRole('dialog', { name: '商品圖片放大檢視' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '關閉放大圖片' }))
    expect(screen.queryByRole('dialog', { name: '商品圖片放大檢視' })).not.toBeInTheDocument()
  })

  it('點選顏色後跳到該顏色圖片，但所有圖片仍可瀏覽', () => {
    function ColorButtons() {
      const { setColor } = useProductColor()
      return createElement('button', { type: 'button', onClick: () => setColor('粉色') }, '選擇粉色')
    }
    const colorImages = [
      { url: '/blue.jpg', alt: '藍色正面', color: '藍色' },
      { url: '/pink.jpg', alt: '粉色正面', color: '粉色' },
      { url: '/detail.jpg', alt: '共用細節', color: null },
    ]

    render(createElement(ProductColorProvider, { initialColor: '藍色' },
      createElement(ColorButtons),
      createElement(ProductGallery, { images: colorImages, isNew: false }),
    ))

    // All three photos stay reachable regardless of the selected colour.
    expect(screen.getByRole('img', { name: '藍色正面' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /查看第/ })).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: '選擇粉色' }))
    expect(screen.getByRole('img', { name: '粉色正面' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /查看第/ })).toHaveLength(3)

    // The shared detail shot is still browsable after switching colour.
    fireEvent.click(screen.getByRole('button', { name: '查看第 3 張商品圖片' }))
    expect(screen.getByRole('img', { name: '共用細節' })).toBeInTheDocument()
  })
})
