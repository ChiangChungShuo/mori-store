import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createE2EStore, getE2EStore } from '@/testing/e2e-store'
import { getE2EProduct } from '@/testing/e2e-storefront-fixtures'
import { getAdminProduct, listAdminProducts, setProductPublished, updateProduct } from '@/features/admin/product-actions'

const adminGate = vi.hoisted(() => ({ requireAdmin: vi.fn(async () => undefined) }))
const supabase = vi.hoisted(() => ({ createClient: vi.fn() }))

vi.mock('@/lib/auth/require-admin', () => adminGate)
vi.mock('@/lib/supabase/server', () => supabase)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  const source = createE2EStore()
  const store = getE2EStore()
  Object.assign(store, source)
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('MORI_E2E_FIXTURES', '1')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('fixture product management', () => {
  it('updates price, inventory and publication in the shared storefront catalog', async () => {
    const products = await listAdminProducts()
    const detail = await getAdminProduct(products[0].id)
    expect(detail).not.toBeNull()

    const result = await updateProduct(products[0].id, {
      ...detail!.product,
      name: '小樹 T 恤新版',
      variants: detail!.product.variants.map((variant, index) => ({
        ...variant,
        price: index === 0 ? 720 : variant.price,
        cost: index === 0 ? 280 : variant.cost,
        stock: index === 0 ? 4 : variant.stock,
      })),
    })

    expect(result.ok).toBe(true)
    expect(getE2EProduct('mori-organic-cotton-tee')).toMatchObject({
      name: '小樹 T 恤新版',
      variants: expect.arrayContaining([expect.objectContaining({ price: 720, stock: 4 })]),
    })
    expect((await getAdminProduct(products[0].id))?.product.variants)
      .toEqual(expect.arrayContaining([expect.objectContaining({ price: 720, cost: 280, stock: 4 })]))

    await setProductPublished(products[0].id, false)
    expect(getE2EProduct('mori-organic-cotton-tee')).toBeNull()
    expect(supabase.createClient).not.toHaveBeenCalled()
  })
})
