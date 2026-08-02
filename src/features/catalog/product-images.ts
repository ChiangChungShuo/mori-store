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
