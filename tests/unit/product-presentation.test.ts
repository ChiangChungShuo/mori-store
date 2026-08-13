import { describe, expect, it } from 'vitest'
import { colorFamily, listColorFamilies, normalizeProductName, normalizeSeriesName } from '@/features/catalog/product-presentation'

describe('product presentation', () => {
  it('normalizes known Mori series names and punctuation', () => {
    expect(normalizeProductName(' Mori Flora漫花系列 | 小花漫步澎澎褲 ( 2色） '))
      .toBe('Mori Flora｜小花漫步澎澎褲（2色）')
    expect(normalizeProductName('Mori Lemto慢日系列| 抱抱褲'))
      .toBe('Mori Lento｜抱抱褲')
    expect(normalizeProductName('Mori olive｜雲朵套裝'))
      .toBe('Mori Olive｜雲朵套裝')
    expect(normalizeProductName('Mori Olive 森語系列｜兜Dot上衣（2色）'))
      .toBe('Mori Olive｜兜Dot上衣（2色）')
  })

  it('uses one canonical label for each collection in navigation and filters', () => {
    expect(normalizeSeriesName('Mori Lemto|慢日系列')).toBe('Mori Lento｜慢日系列')
    expect(normalizeSeriesName('Mori Blanche |純境系列')).toBe('Mori Blanche｜純境系列')
    expect(normalizeSeriesName('Mori olive森語系列')).toBe('Mori Olive｜森語系列')
  })

  it('groups detailed variant names into shopper-facing color families', () => {
    expect(colorFamily('深海軍藍')).toBe('藍')
    expect(colorFamily('燕麥米')).toBe('咖')
    expect(colorFamily('Mini抱抱')).toBe('花色／圖案')
    expect(listColorFamilies(['Mini抱抱', '鼠尾草綠', '白色', '灰藍']))
      .toEqual(['白', '灰', '綠', '花色／圖案'])
  })
})
