import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('storefront brand contract', () => {
  it('uses MORIMUR BABY as the public brand name', () => {
    const publicCopy = [
      read('src/app/layout.tsx'),
      read('src/components/site-header.tsx'),
      read('src/components/site-footer.tsx'),
      read('src/app/(store)/page.tsx'),
      read('src/app/(store)/terms/page.tsx'),
      read('src/app/(store)/privacy/page.tsx'),
      read('src/app/(store)/contact/page.tsx'),
      read('src/features/auth/auth-form.tsx'),
      read('src/features/auth/signup-form.tsx'),
    ].join('\n')

    expect(publicCopy).toContain('MORIMUR BABY')
    expect(publicCopy).not.toMatch(/mori 童裝商城|mori kids select/)
  })
})
