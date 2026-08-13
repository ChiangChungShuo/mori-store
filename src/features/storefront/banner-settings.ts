import { z } from 'zod'
import { productImageSchema } from '@/lib/validation/product'
import type { Json } from '@/types/database'

const internalHref = z.string().trim().refine((value) => value.startsWith('/') && !value.startsWith('//'), '連結必須是站內路徑')

export const bannerSlideSchema = z.object({
  imageUrl: z.string().trim().min(1),
  imageAlt: z.string().trim().min(1, '圖片說明為必填'),
  eyebrow: z.string().trim().min(1, '英文小標為必填'),
  title: z.string().trim().min(1, '主標題為必填'),
  body: z.string().trim().min(1, '說明文字為必填'),
  buttonLabel: z.string().trim().min(1, '按鈕文字為必填'),
  buttonHref: internalHref,
  startsAt: z.string().date().optional(),
  endsAt: z.string().date().optional(),
}).strict()

const bannerSlidesSchema = z.array(bannerSlideSchema).min(1).max(5)
export type BannerSlide = z.infer<typeof bannerSlideSchema>

const TAIPEI_OFFSET = '+08:00'

export function activeBannerSlides(slides: BannerSlide[], now = new Date()) {
  const timestamp = now.getTime()
  return slides.filter((slide) => {
    const startsAt = slide.startsAt ? Date.parse(`${slide.startsAt}T00:00:00${TAIPEI_OFFSET}`) : null
    const endsAt = slide.endsAt ? Date.parse(`${slide.endsAt}T23:59:59.999${TAIPEI_OFFSET}`) : null
    return (startsAt === null || startsAt <= timestamp) && (endsAt === null || endsAt >= timestamp)
  })
}

function visibleBannerSlides(slides: BannerSlide[]) {
  const activeSlides = activeBannerSlides(slides)
  return activeSlides.length > 0 ? activeSlides : defaultBannerSlides
}

export const defaultBannerSlides: BannerSlide[] = [{
  imageUrl: '/images/mori-hero.jpg',
  imageAlt: '兩位穿著舒適童裝的孩子在庭院散步',
  eyebrow: 'MORIMUR BABY seasonal edit',
  title: '小小日常，\n自在長大。',
  body: '替 0–12 歲孩子挑選柔軟、好活動、每天都願意穿的衣服。',
  buttonLabel: '選購本週新品',
  buttonHref: '/#new',
}, {
  imageUrl: '/images/products/mori-meadow-dress.jpg',
  imageAlt: '森林綠小花花野洋裝',
  eyebrow: 'weekend in green',
  title: '把舒服，\n穿進週末。',
  body: '親膚材質與自在版型，陪孩子從日常一路玩到旅行。',
  buttonLabel: '看看本週選品',
  buttonHref: '/products',
}]

function parseSlides(value: Json | undefined) {
  const parsed = bannerSlidesSchema.safeParse(value)
  return parsed.success ? parsed.data : defaultBannerSlides
}

export async function getBannerSlides(): Promise<BannerSlide[]> {
  const { isE2EMode } = await import('@/testing/e2e-mode')
  if (isE2EMode()) {
    const { getE2EStore } = await import('@/testing/e2e-store')
    const slides = getE2EStore().bannerSlides ?? defaultBannerSlides
    return visibleBannerSlides(slides)
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return defaultBannerSlides

  const { createClient } = await import('@/lib/supabase/server')
  const { data, error } = await (await createClient())
    .from('store_settings')
    .select('value')
    .eq('key', 'home_banner_slides')
    .maybeSingle()
  if (error) throw error
  return visibleBannerSlides(parseSlides(data?.value))
}

async function uploadBanner(file: File) {
  const { isE2EMode } = await import('@/testing/e2e-mode')
  if (isE2EMode()) {
    const bytes = Buffer.from(await file.arrayBuffer()).toString('base64')
    return `data:${file.type};base64,${bytes}`
  }

  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
  const path = `banners/${crypto.randomUUID()}.${extension}`
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type })
  if (error) throw error
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

export type BannerSaveState = { ok: boolean; message: string }

export async function updateBannerSlidesFromForm(
  _previousState: BannerSaveState,
  formData: FormData,
): Promise<BannerSaveState> {
  'use server'
  const { requireAdmin } = await import('@/lib/auth/require-admin')
  await requireAdmin()

  try {
    const count = Math.min(5, Math.max(1, Number(formData.get('slideCount')) || 1))
    const slides: BannerSlide[] = []
    for (let index = 0; index < count; index += 1) {
      const imageAlt = String(formData.get(`imageAlt-${index}`) ?? '')
      const file = formData.get(`image-${index}`)
      let imageUrl = String(formData.get(`imageUrl-${index}`) ?? '')
      const title = String(formData.get(`title-${index}`) ?? '')
      // Skip an entirely blank slot (a freshly added, not-yet-filled slide).
      if (!imageUrl && (!(file instanceof File) || file.size === 0) && !title.trim()) continue
      if (file instanceof File && file.size > 0) {
        const image = await productImageSchema.safeParseAsync({ file, alt: imageAlt })
        if (!image.success) return { ok: false, message: image.error.issues[0]?.message ?? '圖片格式無效' }
        imageUrl = await uploadBanner(image.data.file)
      }
      slides.push({
        imageUrl,
        imageAlt,
        eyebrow: String(formData.get(`eyebrow-${index}`) ?? ''),
        title,
        body: String(formData.get(`body-${index}`) ?? ''),
        buttonLabel: String(formData.get(`buttonLabel-${index}`) ?? ''),
        buttonHref: String(formData.get(`buttonHref-${index}`) ?? ''),
        ...(formData.get(`startsAt-${index}`) ? { startsAt: String(formData.get(`startsAt-${index}`)) } : {}),
        ...(formData.get(`endsAt-${index}`) ? { endsAt: String(formData.get(`endsAt-${index}`)) } : {}),
      })
    }
    const parsed = bannerSlidesSchema.safeParse(slides)
    if (!parsed.success) {
      return { ok: false, message: `請完整填寫每張輪播的欄位（${parsed.error.issues[0]?.message ?? '內容不完整'}）` }
    }

    const { isE2EMode } = await import('@/testing/e2e-mode')
    if (isE2EMode()) {
      const { getE2EStore } = await import('@/testing/e2e-store')
      getE2EStore().bannerSlides = parsed.data
    } else {
      const { createClient } = await import('@/lib/supabase/server')
      const { error } = await (await createClient()).from('store_settings').upsert({ key: 'home_banner_slides', value: parsed.data as Json }, { onConflict: 'key' })
      if (error) return { ok: false, message: '儲存失敗，請稍後再試' }
    }
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/')
    revalidatePath('/admin/settings')
    return { ok: true, message: '首頁輪播已更新' }
  } catch (error) {
    console.error('[banner] save failed', error)
    return { ok: false, message: '儲存時發生錯誤，請稍後再試' }
  }
}
