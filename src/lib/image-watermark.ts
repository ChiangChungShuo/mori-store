// Burns a watermark into a photo in the browser, right before it is sent to the
// upload action. Doing it here (rather than on the server) keeps the admin free
// of a native image dependency, works with the existing compression step, and
// lets the owner see exactly what will be stored.

export type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'center' | 'bottom-center'
export type WatermarkKind = 'logo' | 'text'
export type WatermarkSize = 'small' | 'medium' | 'large'

/** The brand badge, served from public/. */
export const WATERMARK_LOGO_SRC = '/brand/morimur-baby-logo.png'

export type WatermarkOptions = {
  kind?: WatermarkKind
  text?: string
  position?: WatermarkPosition
  size?: WatermarkSize
  opacity?: number
}

// Share of the photo width taken by the mark.
const logoScales: Record<WatermarkSize, number> = { small: 0.14, medium: 0.2, large: 0.28 }
const textScales: Record<WatermarkSize, number> = { small: 0.045, medium: 0.062, large: 0.085 }
const JPEG_QUALITY = 0.9
const STORAGE_KEY = 'mori-watermark'

export type WatermarkPreference = {
  enabled: boolean
  kind: WatermarkKind
  text: string
  position: WatermarkPosition
  size: WatermarkSize
  opacity: number
}

export const defaultWatermarkPreference: WatermarkPreference = {
  enabled: true,
  kind: 'logo',
  text: 'Moribebe',
  position: 'bottom-right',
  size: 'medium',
  opacity: 0.9,
}

const positions: WatermarkPosition[] = ['bottom-right', 'bottom-left', 'bottom-center', 'center']
const sizes: WatermarkSize[] = ['small', 'medium', 'large']

/** Remembers the owner's watermark choice across uploads and pages. */
export function readWatermarkPreference(): WatermarkPreference {
  if (typeof window === 'undefined') return defaultWatermarkPreference
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaultWatermarkPreference
    const parsed = JSON.parse(stored) as Partial<WatermarkPreference>
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaultWatermarkPreference.enabled,
      kind: parsed.kind === 'text' || parsed.kind === 'logo' ? parsed.kind : defaultWatermarkPreference.kind,
      text: typeof parsed.text === 'string' && parsed.text ? parsed.text : defaultWatermarkPreference.text,
      position: parsed.position && positions.includes(parsed.position) ? parsed.position : defaultWatermarkPreference.position,
      size: parsed.size && sizes.includes(parsed.size) ? parsed.size : defaultWatermarkPreference.size,
      opacity: typeof parsed.opacity === 'number' && parsed.opacity > 0 && parsed.opacity <= 1
        ? parsed.opacity
        : defaultWatermarkPreference.opacity,
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
  const kind = options.kind ?? 'logo'
  const text = (options.text ?? '').trim()
  if (kind === 'text' && !text) return file

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
    context.globalAlpha = options.opacity ?? defaultWatermarkPreference.opacity

    if (kind === 'logo') {
      const logo = await loadLogo()
      const markWidth = Math.max(48, Math.round(width * logoScales[options.size ?? 'medium']))
      const markHeight = Math.round(markWidth * (logo.naturalHeight / logo.naturalWidth || 1))
      const spot = anchor(options.position ?? 'bottom-right', width, height, markWidth, markHeight)
      // The badge PNG has an opaque near-white background, so clip it to its
      // circle — otherwise a pale square would sit on top of the photo.
      context.save()
      context.beginPath()
      context.arc(spot.x + markWidth / 2, spot.y + markHeight / 2, Math.min(markWidth, markHeight) * 0.49, 0, Math.PI * 2)
      context.closePath()
      context.clip()
      context.drawImage(logo, spot.x, spot.y, markWidth, markHeight)
      context.restore()
    } else {
      const fontSize = Math.max(14, Math.round(width * textScales[options.size ?? 'medium']))
      // Serif matches the storefront's brand type; the shadow keeps white text
      // legible on pale fabric.
      context.font = `${fontSize}px Georgia, "Times New Roman", "Noto Serif TC", serif`
      context.textAlign = options.position === 'bottom-right' ? 'right' : options.position === 'bottom-left' ? 'left' : 'center'
      context.textBaseline = options.position === 'center' ? 'middle' : 'alphabetic'
      context.shadowColor = 'rgba(40, 48, 56, 0.35)'
      context.shadowBlur = Math.round(fontSize * 0.35)
      context.fillStyle = '#ffffff'
      const padding = Math.round(width * 0.045)
      const x = options.position === 'bottom-right' ? width - padding
        : options.position === 'bottom-left' ? padding
        : width / 2
      const y = options.position === 'center' ? height / 2 : height - padding
      context.fillText(text, x, y)
    }

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
