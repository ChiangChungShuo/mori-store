import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const accountLayout = readFileSync(
  resolve(process.cwd(), 'src/app/account/layout.tsx'),
  'utf8',
)

describe('account layout', () => {
  it('provides an authenticated sign-out form', () => {
    expect(accountLayout).toMatch(/import \{ signOut \} from ['"]@\/features\/auth\/actions['"]/)
    expect(accountLayout).toMatch(/<form[^>]*action=\{signOut\}[^>]*>[\s\S]*<button[^>]*>登出<\/button>[\s\S]*<\/form>/)
  })
})
