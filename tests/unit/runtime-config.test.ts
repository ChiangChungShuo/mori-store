import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Node.js runtime contract', () => {
  it('requires Node.js 22 consistently', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { engines?: { node?: string } }
    const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8')
    const localSetup = readFileSync(resolve(process.cwd(), 'docs/local-setup.md'), 'utf8')
    const nvmrcPath = resolve(process.cwd(), '.nvmrc')
    const nvmrc = existsSync(nvmrcPath) ? readFileSync(nvmrcPath, 'utf8').trim() : ''

    expect(packageJson.engines?.node).toBe('>=22')
    expect(nvmrc).toBe('22')
    expect(readme).not.toContain('20.9')
    expect(localSetup).not.toContain('20.9')
  })
})
