import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

// Default share card for LINE / Facebook / IG link previews. Product pages
// override this with their own photo via generateMetadata; every other page
// (home, catalog, FAQ…) falls back to this branded card.
//
// Latin text only: ImageResponse's built-in font has no CJK glyphs, and
// bundling a Chinese font would add megabytes for a static card.

export const alt = 'MORIMUR BABY — moribebe.com'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), 'src/app/icon.png'))
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          background: 'linear-gradient(160deg, #f4f8fa 0%, #dde5ea 100%)',
        }}
      >
        {/* Satori does not clip children via overflow, so round the img itself. */}
        <img
          alt=""
          height={176}
          src={logoSrc}
          style={{ borderRadius: 88, boxShadow: '0 12px 40px rgba(82, 102, 122, 0.25)' }}
          width={176}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: 14,
            color: '#3d4d5c',
          }}
        >
          MORIMUR BABY
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            letterSpacing: 8,
            color: '#6a7f90',
          }}
        >
          baby &amp; kids · 0–12
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 10,
            border: '2px solid #b9cad6',
            borderRadius: 999,
            padding: '12px 34px',
            fontSize: 26,
            letterSpacing: 4,
            color: '#52667a',
            background: 'rgba(255,255,255,0.55)',
          }}
        >
          moribebe.com
        </div>
      </div>
    ),
    size,
  )
}
