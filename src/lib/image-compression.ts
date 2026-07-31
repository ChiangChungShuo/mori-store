// Downscales large photos in the browser before they are sent to a server
// action. Phone/tablet photos are routinely 3–8 MB, which both exceeds the
// server-action body limit and can exhaust Safari's per-tab memory on iPad.
// Storefront images never need more than ~2000px, so resizing here keeps
// uploads reliable without any visible quality loss.

const MAX_DIMENSION = 2000
const JPEG_QUALITY = 0.85
// Files at or below this size are already web-friendly; leave them untouched.
const SKIP_BELOW_BYTES = 1_200_000

const COMPRESSIBLE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function canCompress(file: File) {
  return COMPRESSIBLE_TYPES.includes(file.type)
    && file.size > SKIP_BELOW_BYTES
    && typeof document !== 'undefined'
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('image_decode_failed'))
      image.src = url
    })
  } finally {
    // Revoked after decode; the canvas keeps its own copy of the pixels.
    URL.revokeObjectURL(url)
  }
}

/**
 * Returns a resized copy of `file`, or the original when resizing is
 * unnecessary or unsupported. Never throws — upload should proceed either way.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!canCompress(file)) return file

  try {
    const image = await loadImage(file)
    const largestSide = Math.max(image.naturalWidth, image.naturalHeight)
    if (!largestSide) return file

    const scale = Math.min(1, MAX_DIMENSION / largestSide)
    const width = Math.round(image.naturalWidth * scale)
    const height = Math.round(image.naturalHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(image, 0, 0, width, height)

    // Keep PNG transparency; everything else compresses better as JPEG.
    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, JPEG_QUALITY)
    })
    // Free the backing store early — important on memory-constrained tablets.
    canvas.width = 0
    canvas.height = 0
    if (!blob || blob.size >= file.size) return file

    const extension = outputType === 'image/png' ? 'png' : 'jpg'
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
    return new File([blob], `${baseName}.${extension}`, { type: outputType })
  } catch {
    return file
  }
}

/** Compresses sequentially so only one full-size bitmap is in memory at a time. */
export async function compressImagesForUpload(files: File[]): Promise<File[]> {
  const output: File[] = []
  for (const file of files) output.push(await compressImageForUpload(file))
  return output
}
