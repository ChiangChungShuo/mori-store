import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const localEnvPath = resolve(process.cwd(), '.env.local')
if (existsSync(localEnvPath)) process.loadEnvFile(localEnvPath)

const externalBaseURL = process.env.E2E_BASE_URL
const localBaseURL = 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './tests/e2e',
  webServer: externalBaseURL ? undefined : {
    command: 'pnpm dev --hostname 127.0.0.1',
    url: localBaseURL,
    reuseExistingServer: true,
    env: { MORI_E2E_FIXTURES: '1' },
  },
  use: {
    baseURL: externalBaseURL ?? localBaseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
      },
    },
  ],
})
