import { configDefaults, defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
