import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readPngSize(path: string) {
  const png = readFileSync(path)
  expect(png.subarray(1, 4).toString()).toBe('PNG')
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

describe('MORIMUR BABY brand assets', () => {
  it('ships square logo and favicon PNGs from the supplied badge', () => {
    const logo = resolve(process.cwd(), 'public/brand/morimur-baby-logo.png')
    const icon = resolve(process.cwd(), 'src/app/icon.png')

    expect(existsSync(logo)).toBe(true)
    expect(existsSync(icon)).toBe(true)
    expect(readPngSize(logo)).toEqual({ width: 720, height: 720 })
    expect(readPngSize(icon)).toEqual({ width: 512, height: 512 })
  })

  it('renders the shared logo asset instead of the legacy inline svg', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/components/brand-logo.tsx'), 'utf8')

    expect(component).toContain('/brand/morimur-baby-logo.png')
    expect(component).not.toContain('<svg')
    expect(existsSync(resolve(process.cwd(), 'src/app/icon.svg'))).toBe(false)
  })
})
