// Burns a text watermark into a photo in the browser, right before it is sent
// to the upload action. Doing it here (rather than on the server) keeps the
// admin free of a native image dependency, works with the existing compression
// step, and lets the owner see exactly what will be stored.

export type WatermarkPosition = 'bottom-right' | 'center' | 'bottom-center'

export type WatermarkOptions = {
  text: string
  position?: WatermarkPosition
  /** Share of the image width used for the glyph height. */
  scale?: number
  opacity?: number
}

const DEFAULT_SCALE = 0.062
const DEFAULT_OPACITY = 0.8
const JPEG_QUALITY = 0.9

const STORAGE_KEY = 'mori-watermark'

export type WatermarkPreference = { enabled: boolean; text: string; position: WatermarkPosition }

export const defaultWatermarkPreference: WatermarkPreference = {
  enabled: true,
  text: 'Moribebe',
  position: 'bottom-right',
}

/** Remembers the owner's watermark choice across uploads and pages. */
export function readWatermarkPreference(): WatermarkPreference {
  if (typeof window === 'undefined') return defaultWatermarkPreference
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaultWatermarkPreference
    const parsed = JSON.parse(stored) as Partial<WatermarkPreference>
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaultWatermarkPreference.enabled,
      text: typeof parsed.text === 'string' ? parsed.text : defaultWatermarkPreference.text,
      position: parsed.position === 'center' || parsed.position === 'bottom-center' || parsed.position === 'bottom-right'
        ? parsed.position
        : defaultWatermarkPreference.position,
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
  return applyWatermark(file, { text: preference.text, position: preference.position })
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('image_decode_failed'))
      // A file the browser cannot decode would otherwise stall the upload.
      window.setTimeout(() => reject(new Error('image_decode_timeout')), 15_000)
      image.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function placement(
  position: WatermarkPosition,
  width: number,
  height: number,
  fontSize: number,
) {
  const padding = Math.round(width * 0.045)
  if (position === 'center') {
    return { x: width / 2, y: height / 2, align: 'center' as CanvasTextAlign, baseline: 'middle' as CanvasTextBaseline }
  }
  if (position === 'bottom-center') {
    return { x: width / 2, y: height - padding, align: 'center' as CanvasTextAlign, baseline: 'alphabetic' as CanvasTextBaseline }
  }
  return { x: width - padding, y: height - padding - fontSize * 0.1, align: 'right' as CanvasTextAlign, baseline: 'alphabetic' as CanvasTextBaseline }
}

/**
 * Returns a copy of `file` with the watermark drawn on it, or the original file
 * when the browser cannot render it. Never throws — the upload should proceed
 * either way, just without the watermark.
 */
export async function applyWatermark(file: File, options: WatermarkOptions): Promise<File> {
  const text = options.text.trim()
  if (!text || typeof document === 'undefined') return file
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file

  try {
    // Probe the canvas before decoding: environments without 2D canvas (jsdom,
    // ancient browsers) must bail out here rather than awaiting an image load
    // that will never resolve.
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return file

    const image = await loadImage(file)
    const width = image.naturalWidth
    const height = image.naturalHeight
    if (!width || !height) return file

    canvas.width = width
    canvas.height = height
    context.drawImage(image, 0, 0, width, height)

    const fontSize = Math.max(14, Math.round(width * (options.scale ?? DEFAULT_SCALE)))
    const spot = placement(options.position ?? 'bottom-right', width, height, fontSize)
    // Serif matches the storefront's brand type; the shadow keeps white text
    // legible on pale fabric.
    context.font = `${fontSize}px Georgia, "Times New Roman", "Noto Serif TC", serif`
    context.textAlign = spot.align
    context.textBaseline = spot.baseline
    context.globalAlpha = options.opacity ?? DEFAULT_OPACITY
    context.shadowColor = 'rgba(40, 48, 56, 0.35)'
    context.shadowBlur = Math.round(fontSize * 0.35)
    context.fillStyle = '#ffffff'
    context.fillText(text, spot.x, spot.y)

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
