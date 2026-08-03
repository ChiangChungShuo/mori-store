export type CatalogProductImage = {
  url: string
  alt: string
  color: string | null
}

export function imagesForColor(
  images: readonly CatalogProductImage[],
  color: string,
): CatalogProductImage[] {
  const matching = images.filter((image) => image.color === color)
  if (matching.length === 0) return [...images]
  return [...matching, ...images.filter((image) => image.color === null)]
}

export function primaryImageForColor(
  images: readonly CatalogProductImage[],
  color: string,
) {
  return imagesForColor(images, color)[0]
}

/**
 * Index of the first image tagged with `color`, or 0 when the colour has no
 * own photo. The gallery keeps showing every image and just jumps here, so a
 * shopper picking a colour never loses sight of the other angles.
 */
export function firstImageIndexForColor(
  images: readonly CatalogProductImage[],
  color: string,
): number {
  const index = images.findIndex((image) => image.color === color)
  return index >= 0 ? index : 0
}
