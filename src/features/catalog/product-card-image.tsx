'use client'

import Image from 'next/image'
import { useState } from 'react'

// Card photo that reveals the product's second image on hover. The second
// image only mounts after the first hover, so mobile shoppers (no hover) and
// the initial page load never pay for the extra download.
export function ProductCardImage({ url, hoverUrl, alt }: {
  url: string
  hoverUrl?: string | null
  alt: string
}) {
  const [showHover, setShowHover] = useState(false)

  return (
    <span
      className="product-card-image-swap"
      onMouseEnter={hoverUrl ? () => setShowHover(true) : undefined}
    >
      <Image
        alt={alt}
        className="product-image"
        fill
        sizes="(max-width: 40rem) 50vw, (max-width: 64rem) 33vw, 25vw"
        src={url}
      />
      {showHover && hoverUrl ? (
        <Image
          alt=""
          className="product-image product-image-hover"
          fill
          sizes="(max-width: 40rem) 50vw, (max-width: 64rem) 33vw, 25vw"
          src={hoverUrl}
        />
      ) : null}
    </span>
  )
}
