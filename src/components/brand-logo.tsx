import Image from 'next/image'

export function BrandLogo({ subtitle = 'kids select' }: { subtitle?: string }) {
  return (
    <span className="brand-logo-lockup">
      <Image
        alt=""
        className="brand-logo-image"
        height={720}
        priority
        src="/brand/morimur-baby-logo.png"
        width={720}
      />
      <span className="sr-only">{subtitle}</span>
    </span>
  )
}
