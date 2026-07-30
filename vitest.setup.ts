import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Provide a no-op Next.js app router so components calling useRouter() render
// in the jsdom test environment (there is no router provider mounted).
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>()
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    }),
  }
})
