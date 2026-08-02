import { describe, expect, it } from 'vitest'
import { imagesForColor, primaryImageForColor } from '@/features/catalog/product-images'

const images = [
  { url: '/blue-1.jpg', alt: '藍色正面', color: '藍色' },
  { url: '/shared.jpg', alt: '布料細節', color: null },
  { url: '/gray-1.jpg', alt: '灰色正面', color: '灰色' },
  { url: '/blue-2.jpg', alt: '藍色背面', color: '藍色' },
]

describe('imagesForColor', () => {
  it('keeps matching images in order and appends shared images', () => {
    expect(imagesForColor(images, '藍色').map((image) => image.url))
      .toEqual(['/blue-1.jpg', '/blue-2.jpg', '/shared.jpg'])
  })

  it('falls back to the original gallery when a color has no image', () => {
    expect(imagesForColor(images, '粉色')).toEqual(images)
  })

  it('uses the first matching image as the selected-color primary image', () => {
    expect(primaryImageForColor(images, '灰色')?.url).toBe('/gray-1.jpg')
  })
})
