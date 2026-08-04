// Burns a watermark into a photo in the browser, right before it is sent to the
// upload action. Doing it here (rather than on the server) keeps the admin free
// of a native image dependency, works with the existing compression step, and
// lets the owner see exactly what will be stored.

export type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'center' | 'bottom-center'
export type WatermarkSize = 'tiny' | 'small' | 'medium' | 'large'
export type WatermarkOpacity = 'faint' | 'soft' | 'clear'

/** The brand badge, served from public/. */
export const WATERMARK_LOGO_SRC = '/brand/morimur-baby-logo.png'

export type WatermarkOptions = {
  position?: WatermarkPosition
  size?: WatermarkSize
  opacity?: WatermarkOpacity
}

// Share of the photo width taken by the badge. Small values keep the mark
// unobtrusive on a product photo.
const logoScales: Record<WatermarkSize, number> = { tiny: 0.07, small: 0.1, medium: 0.14, large: 0.2 }
const opacityLevels: Record<WatermarkOpacity, number> = { faint: 0.3, soft: 0.45, clear: 0.65 }
const JPEG_QUALITY = 0.9
const STORAGE_KEY = 'mori-watermark'

export type WatermarkPreference = {
  enabled: boolean
  position: WatermarkPosition
  size: WatermarkSize
  opacity: WatermarkOpacity
}

export const defaultWatermarkPreference: WatermarkPreference = {
  enabled: true,
  position: 'bottom-right',
  size: 'small',
  opacity: 'soft',
}

const positions: WatermarkPosition[] = ['bottom-right', 'bottom-left', 'bottom-center', 'center']
const sizes: WatermarkSize[] = ['tiny', 'small', 'medium', 'large']
const opacities: WatermarkOpacity[] = ['faint', 'soft', 'clear']

/** Remembers the owner's watermark choice across uploads and pages. */
export function readWatermarkPreference(): WatermarkPreference {
  if (typeof window === 'undefined') return defaultWatermarkPreference
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaultWatermarkPreference
    const parsed = JSON.parse(stored) as Partial<WatermarkPreference>
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaultWatermarkPreference.enabled,
      position: parsed.position && positions.includes(parsed.position) ? parsed.position : defaultWatermarkPreference.position,
      size: parsed.size && sizes.includes(parsed.size) ? parsed.size : defaultWatermarkPreference.size,
      opacity: parsed.opacity && opacities.includes(parsed.opacity) ? parsed.opacity : defaultWatermarkPreference.opacity,
    }
  } catch {
    return defaultWatermarkPreference
  }
}

export function writeWatermarkPreference(preference: WatermarkPreference) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference))
  } catch {
    // Private-mode storage failures must not block an upload.
  }
}

/** Applies the stored preference, so every upload path watermarks the same way. */
export async function applyStoredWatermark(file: File): Promise<File> {
  const preference = readWatermarkPreference()
  if (!preference.enabled) return file
  return applyWatermark(file, preference)
}

function loadImageElement(src: string, revoke = false): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => { if (revoke) URL.revokeObjectURL(src); resolve(image) }
    image.onerror = () => { if (revoke) URL.revokeObjectURL(src); reject(new Error('image_decode_failed')) }
    // A file the browser cannot decode would otherwise stall the upload.
    window.setTimeout(() => reject(new Error('image_decode_timeout')), 15_000)
    image.src = src
  })
}

function loadFile(file: File) {
  return loadImageElement(URL.createObjectURL(file), true)
}

// The badge is reused for every photo in a batch, so decode it once.
let logoPromise: Promise<HTMLImageElement> | null = null
function loadLogo() {
  logoPromise ??= loadImageElement(WATERMARK_LOGO_SRC).catch((error) => {
    logoPromise = null
    throw error
  })
  return logoPromise
}

function anchor(position: WatermarkPosition, width: number, height: number, markWidth: number, markHeight: number) {
  const padding = Math.round(width * 0.04)
  if (position === 'center') {
    return { x: Math.round((width - markWidth) / 2), y: Math.round((height - markHeight) / 2) }
  }
  if (position === 'bottom-center') {
    return { x: Math.round((width - markWidth) / 2), y: height - markHeight - padding }
  }
  if (position === 'bottom-left') {
    return { x: padding, y: height - markHeight - padding }
  }
  return { x: width - markWidth - padding, y: height - markHeight - padding }
}

/**
 * Returns a copy of `file` with the watermark drawn on it, or the original file
 * when the browser cannot render it. Never throws — the upload should proceed
 * either way, just without the watermark.
 */
export async function applyWatermark(file: File, options: WatermarkOptions = {}): Promise<File> {
  if (typeof document === 'undefined') return file
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file

  try {
    // Probe the canvas before decoding: environments without 2D canvas (jsdom,
    // ancient browsers) must bail out here rather than awaiting an image load
    // that will never resolve.
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return file

    const photo = await loadFile(file)
    const width = photo.naturalWidth
    const height = photo.naturalHeight
    if (!width || !height) return file

    canvas.width = width
    canvas.height = height
    context.drawImage(photo, 0, 0, width, height)

    const logo = await loadLogo()
    const markWidth = Math.max(40, Math.round(width * logoScales[options.size ?? defaultWatermarkPreference.size]))
    const markHeight = Math.round(markWidth * (logo.naturalHeight / logo.naturalWidth || 1))
    const spot = anchor(options.position ?? defaultWatermarkPreference.position, width, height, markWidth, markHeight)
    context.globalAlpha = opacityLevels[options.opacity ?? defaultWatermarkPreference.opacity]
    // The badge PNG has an opaque near-white background, so clip it to its
    // circle — otherwise a pale square would sit on top of the photo.
    context.save()
    context.beginPath()
    context.arc(spot.x + markWidth / 2, spot.y + markHeight / 2, Math.min(markWidth, markHeight) * 0.49, 0, Math.PI * 2)
    context.closePath()
    context.clip()
    context.drawImage(logo, spot.x, spot.y, markWidth, markHeight)
    context.restore()

    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, JPEG_QUALITY)
    })
    canvas.width = 0
    canvas.height = 0
    if (!blob) return file

    const extension = outputType === 'image/png' ? 'png' : 'jpg'
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
    return new File([blob], `${baseName}.${extension}`, { type: outputType })
  } catch {
    return file
  }
}
