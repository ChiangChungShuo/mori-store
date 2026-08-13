import { describe, expect, it } from 'vitest'
import { activeBannerSlides, type BannerSlide } from '@/features/storefront/banner-settings'

const slide = (overrides: Partial<BannerSlide> = {}): BannerSlide => ({
  imageUrl: '/hero.jpg',
  imageAlt: '孩子穿著童裝',
  eyebrow: 'season edit',
  title: '自在長大',
  body: '柔軟舒服的日常服。',
  buttonLabel: '選購新品',
  buttonHref: '/products',
  ...overrides,
})

describe('homepage campaign expiry', () => {
  it('hides expired slides and keeps current or undated slides', () => {
    const slides = [
      slide({ title: '已到期', startsAt: '2026-08-01', endsAt: '2026-08-10' }),
      slide({ title: '進行中', startsAt: '2026-08-01', endsAt: '2026-08-20' }),
      slide({ title: '長期品牌圖' }),
    ]

    expect(activeBannerSlides(slides, new Date('2026-08-13T12:00:00+08:00')).map((item) => item.title))
      .toEqual(['進行中', '長期品牌圖'])
  })

  it('treats the end date as inclusive in Taiwan time', () => {
    const slides = [slide({ endsAt: '2026-08-10' })]

    expect(activeBannerSlides(slides, new Date('2026-08-10T23:59:59+08:00'))).toHaveLength(1)
    expect(activeBannerSlides(slides, new Date('2026-08-11T00:00:00+08:00'))).toHaveLength(0)
  })
})
