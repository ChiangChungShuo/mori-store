import { createElement } from 'react'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteHeader } from '@/components/site-header'
import { CartProvider, useCart } from '@/features/cart/cart-provider'
import { ProductCard } from '@/features/catalog/product-card'
import { ProductFilters } from '@/features/catalog/product-filters'
import { ProductSeriesFilter } from '@/features/catalog/product-series-filter'
import { applyCatalogFilters, listProducts, parseProductFilters } from '@/features/catalog/queries'
import type { CatalogProduct } from '@/features/catalog/queries'
import { VariantPicker } from '@/features/catalog/variant-picker'
import { ProductColorProvider } from '@/features/catalog/product-color-context'

const product: CatalogProduct = {
  id: 'product-1',
  slug: 'mori-organic-cotton-tee',
  name: '有機棉小樹 T 恤',
  description: '柔軟透氣的日常有機棉 T 恤。',
  category: '上衣',
  series: [
    { id: '10000000-0000-4000-8000-000000000001', categoryName: '上衣', name: 'Mori flora 漫花系列', position: 0 },
  ],
  ageBands: ['3-6', '6-12'] as const,
  material: '100% 有機棉',
  careInstructions: '建議冷水洗滌。',
  sizeGuide: '版型正常。',
  isNew: true,
  imageUrl: null,
  imageAlt: '有機棉小樹 T 恤',
  images: [
    { url: '/sage.jpg', alt: '鼠尾草綠正面', color: '鼠尾草綠' },
    { url: '/pink.jpg', alt: '珊瑚粉正面', color: '珊瑚粉' },
  ],
  variants: [
    { id: '10000000-0000-4000-8000-000000000101', sku: 'SAGE-100', color: '鼠尾草綠', size: '100', price: 680, compareAtPrice: null, stock: 2 },
    { id: '10000000-0000-4000-8000-000000000102', sku: 'SAGE-120', color: '鼠尾草綠', size: '120', price: 780, compareAtPrice: null, stock: 0 },
    { id: '10000000-0000-4000-8000-000000000103', sku: 'PINK-110', color: '珊瑚粉', size: '110', price: 720, compareAtPrice: null, stock: 3 },
  ],
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('fixture catalog', () => {
  it('filters fixture products by category-specific series', async () => {
    vi.stubEnv('MORI_E2E_FIXTURES', '1')

    const products = await listProducts({ category: '上衣', series: 'Mori flora 漫花系列' })

    expect(products.map((catalogProduct) => catalogProduct.name)).toEqual([
      '有機棉小樹 T 恤',
      '燕麥針織背心',
    ])
  })

  it('offers eight fixture products across every age band and category', async () => {
    vi.stubEnv('MORI_E2E_FIXTURES', '1')

    const products = await listProducts({})

    expect(products).toHaveLength(8)
    expect(new Set(products.flatMap((catalogProduct) => catalogProduct.ageBands)))
      .toEqual(new Set(['0-3', '3-6', '6-12']))
    expect([...new Set(products.map((catalogProduct) => catalogProduct.category))])
      .toEqual(expect.arrayContaining(['上衣', '褲裝', '洋裝', '外套', '幼兒服']))
    expect(products.every((catalogProduct) => catalogProduct.imageUrl?.startsWith('/images/products/'))).toBe(true)
  })

  it('finds a product by a partial color name', () => {
    expect(applyCatalogFilters([
      product,
      { ...product, id: 'product-2', name: '自在長褲', variants: [{ ...product.variants[0], color: '深海軍藍' }] },
    ], { q: '藍' }).map((item) => item.name)).toEqual(['自在長褲'])
  })

  it('removes fully sold-out products when only in-stock is selected', () => {
    const soldOut = { ...product, variants: product.variants.map((variant) => ({ ...variant, stock: 0 })) }
    expect(applyCatalogFilters([soldOut, product], { inStock: true })).toEqual([product])
  })

  it('separates ready, preorder, and popular products', () => {
    const ready = { ...product, id: 'ready', tags: [] }
    const preorder = { ...product, id: 'preorder', tags: ['預購'] }
    const popular = { ...product, id: 'popular', tags: ['熱賣'] }
    expect(applyCatalogFilters([ready, preorder, popular], { view: 'ready' })).toEqual([ready, popular])
    expect(applyCatalogFilters([ready, preorder, popular], { view: 'preorder' })).toEqual([preorder])
    expect(applyCatalogFilters([ready, preorder, popular], { view: 'popular' })).toEqual([popular])
  })
})

describe('parseProductFilters', () => {
  it('uses series only together with a category', () => {
    expect(parseProductFilters({ category: ' 上衣 ', series: ' Mori flora 漫花系列 ' })).toEqual({
      category: '上衣',
      series: 'Mori flora 漫花系列',
    })
    expect(parseProductFilters({ series: 'Mori flora 漫花系列' })).toEqual({})
  })

  it('keeps only the fixed 0-12 age bands and supported stock value', () => {
    expect(parseProductFilters({ q: '  洋裝  ', age: '6-12', color: '鼠尾草綠', inStock: 'true' })).toEqual({
      q: '洋裝',
      age: '6-12',
      color: '鼠尾草綠',
      inStock: true,
    })
    expect(parseProductFilters({ age: '13-15', inStock: 'false' })).toEqual({})
  })

  it('uses the first value when a search parameter is repeated', () => {
    expect(parseProductFilters({ size: ['100', '120'], category: ['上衣', '下著'] })).toEqual({
      size: '100',
      category: '上衣',
    })
  })

  it('accepts only supported storefront views', () => {
    expect(parseProductFilters({ view: 'preorder' })).toEqual({ view: 'preorder' })
    expect(parseProductFilters({ view: 'discounted' })).toEqual({})
  })
})

describe('ProductFilters', () => {
  it('carries the active category and series along as hidden inputs', () => {
    const { container } = render(createElement(ProductFilters, {
      filters: { category: '上衣', series: 'Mori flora 漫花系列' },
    }))

    expect(container.querySelector('input[name="category"]')).toHaveValue('上衣')
    expect(container.querySelector('input[name="series"]')).toHaveValue('Mori flora 漫花系列')
    // 分類 is picked from the pill nav above, not inside the toolbar.
    expect(screen.queryByLabelText('分類')).toBeNull()
  })

  it('keeps 清除條件 inside the current category', () => {
    render(createElement(ProductFilters, {
      filters: { category: '上衣', q: '棉' },
    }))

    const clear = screen.getByRole('link', { name: /清除條件/ })
    const url = new URL(clear.getAttribute('href')!, 'http://localhost')
    expect(url.pathname).toBe('/products')
    expect(url.searchParams.get('category')).toBe('上衣')
  })

  it('renders a GET form whose values come from the current URL filters', () => {
    render(createElement(ProductFilters, {
      filters: { q: '外套', age: '6-12', size: '120', inStock: true },
    }))

    expect(screen.getByRole('form', { name: '篩選商品' })).toHaveAttribute('method', 'get')
    expect(screen.getByLabelText('搜尋商品')).toHaveValue('外套')
    expect(screen.getByLabelText('年齡')).toHaveValue('6-12')
    expect(screen.getByLabelText('尺寸')).toHaveValue('120')
    expect(screen.getByLabelText('只顯示有庫存')).toBeChecked()
  })
})

describe('ProductSeriesFilter', () => {
  it('switches series while preserving the other catalog filters', () => {
    render(createElement(ProductSeriesFilter, {
      filters: {
        category: '上衣',
        series: 'Mori flora 漫花系列',
        q: '棉',
        age: '3-6',
        inStock: true,
      },
      series: [
        { id: '10000000-0000-4000-8000-000000000001', categoryName: '上衣', name: 'Mori flora 漫花系列', position: 0 },
        { id: '10000000-0000-4000-8000-000000000002', categoryName: '上衣', name: 'Mori forest 森林系列', position: 1 },
      ],
    }))

    const allUrl = new URL(screen.getByRole('link', { name: '全部上衣' }).getAttribute('href')!, 'http://localhost')
    expect(allUrl.searchParams.get('category')).toBe('上衣')
    expect(allUrl.searchParams.get('series')).toBeNull()
    expect(allUrl.searchParams.get('q')).toBe('棉')
    expect(allUrl.searchParams.get('age')).toBe('3-6')
    expect(allUrl.searchParams.get('inStock')).toBe('true')

    const forestUrl = new URL(screen.getByRole('link', { name: 'Mori forest 森林系列' }).getAttribute('href')!, 'http://localhost')
    expect(forestUrl.searchParams.get('series')).toBe('Mori forest 森林系列')
    expect(screen.getByRole('link', { name: 'Mori Flora' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('store navigation', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
  })

  it('keeps homepage section links valid from catalog routes', () => {
    render(createElement(SiteHeader))

    expect(screen.getByRole('link', { name: '新品' })).toHaveAttribute('href', '/#new')
    expect(screen.getByRole('link', { name: '依年齡' })).toHaveAttribute('href', '/#ages')
    expect(screen.getByRole('link', { name: '品牌故事' })).toHaveAttribute('href', '/#story')
  })

  it('shows member destinations after login', () => {
    render(createElement(SiteHeader, { isSignedIn: true }))

    expect(screen.getByLabelText('會員選單')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '會員中心' })).toHaveAttribute('href', '/account')
    expect(screen.getByRole('link', { name: '我的訂單' })).toHaveAttribute('href', '/account/orders')
    expect(screen.getByRole('button', { name: '登出' })).toBeInTheDocument()
  })

  it('sends guests through login before member orders', () => {
    render(createElement(SiteHeader))

    expect(screen.getByRole('link', { name: '會員訂單' })).toHaveAttribute('href', '/login?next=/account/orders')
    expect(screen.getByRole('link', { name: '訪客查單' })).toHaveAttribute('href', '/order-lookup')
  })

  it('hides the admin backend link from non-admin visitors', () => {
    render(createElement(SiteHeader, { isSignedIn: true }))

    expect(screen.queryByRole('link', { name: '老闆後台' })).not.toBeInTheDocument()
  })

  it('reveals the admin backend link only to admin accounts', () => {
    render(createElement(SiteHeader, { isSignedIn: true, isAdmin: true }))

    const adminLinks = screen.getAllByRole('link', { name: '老闆後台' })
    expect(adminLinks.length).toBeGreaterThan(0)
    adminLinks.forEach((link) => expect(link).toHaveAttribute('href', '/admin'))
  })
})

describe('ProductCard', () => {
  it('keeps the catalog card focused on options and price, only badging exceptions', () => {
    render(createElement(ProductCard, { product }))

    // 現貨 is the default state — only 預購/售完/即將上架 earn a badge.
    expect(screen.queryByText('現貨')).not.toBeInTheDocument()
    expect(screen.getByText('2 種顏色')).toBeInTheDocument()
    expect(screen.getByText('尺寸 100–120')).toBeInTheDocument()
    expect(screen.getByText('NT$680')).toBeInTheDocument()
    expect(screen.getByText('查看商品')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看 有機棉小樹 T 恤' })).toHaveAttribute(
      'href',
      '/products/mori-organic-cotton-tee',
    )
  })

  it('splits the series prefix into an eyebrow and strips the colour count', () => {
    render(createElement(ProductCard, {
      product: { ...product, name: 'Mori Olive｜華夫格條紋套裝（2色）' },
    }))

    expect(screen.getByText('Mori Olive')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '華夫格條紋套裝' })).toBeInTheDocument()
    expect(screen.queryByText(/（2色）/)).not.toBeInTheDocument()
  })

  it('shows the crossed-out original price when a variant has one', () => {
    render(createElement(ProductCard, {
      product: {
        ...product,
        variants: product.variants.map((variant) => ({ ...variant, compareAtPrice: 790 })),
      },
    }))

    expect(screen.getByText('NT$790')).toBeInTheDocument()
    expect(screen.getByText('NT$790').tagName).toBe('DEL')
  })

  it('does not repeat a single available size', () => {
    render(createElement(ProductCard, { product: { ...product, variants: [product.variants[0]] } }))

    expect(screen.getByText('尺寸 100')).toBeInTheDocument()
    expect(screen.queryByText('尺寸 100–100')).not.toBeInTheDocument()
  })

  it('shows sold-out and scheduled product states', () => {
    const soldOutProduct = { ...product, variants: product.variants.map((variant) => ({ ...variant, stock: 0 })) }
    const { rerender } = render(createElement(ProductCard, {
      product: soldOutProduct,
    }))
    expect(screen.getByText('售完')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `查看 ${product.name}` })).toHaveAttribute('href', `/products/${product.slug}`)
    expect(screen.getByRole('link', { name: product.name })).toHaveAttribute('href', `/products/${product.slug}`)

    rerender(createElement(ProductCard, {
      product: { ...product, availableAt: '2099-01-01T00:00:00.000Z' },
    }))
    expect(screen.getByText('即將上架')).toBeInTheDocument()
    expect(screen.getByText(/預計.*開賣/).closest('.product-image-link')).not.toBeNull()
    expect(screen.queryByText(/預計.*開賣/)?.closest('.product-card-body')).toBeNull()
  })
})

describe('product detail scheduled sale notice', () => {
  it('places the compact notice below the product name rather than below the gallery', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/app/(store)/products/[slug]/page.tsx'), 'utf8')
    const imageColumn = page.match(/<div className="product-detail-image">([\s\S]*?)<div className="product-detail-copy">/)?.[1] ?? ''
    const copyColumn = page.match(/<div className="product-detail-copy">([\s\S]*?)<div className="product-price-row">/)?.[1] ?? ''

    expect(imageColumn).not.toContain('product-detail-availability')
    expect(copyColumn).toContain('product-detail-availability')
    expect(copyColumn).toContain('商品將於')
  })
})

describe('storefront metadata and owner shortcuts', () => {
  it('uses the mori logo system across storefront, member area, admin, and favicon', () => {
    for (const file of [
      'src/components/site-header.tsx',
      'src/components/site-footer.tsx',
      'src/app/account/layout.tsx',
      'src/app/admin/layout.tsx',
    ]) {
      expect(readFileSync(resolve(process.cwd(), file), 'utf8')).toContain('BrandLogo')
    }
    expect(existsSync(resolve(process.cwd(), 'src/app/icon.png'))).toBe(true)
    expect(readFileSync(resolve(process.cwd(), 'src/components/brand-logo.tsx'), 'utf8'))
      .toContain('/brand/morimur-baby-logo.png')
  })

  it('loads editable metadata and conditionally installs Google Analytics', () => {
    const rootLayout = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8')
    const storeLayout = readFileSync(resolve(process.cwd(), 'src/app/(store)/layout.tsx'), 'utf8')
    const productPage = readFileSync(resolve(process.cwd(), 'src/app/(store)/products/[slug]/page.tsx'), 'utf8')

    expect(rootLayout).toContain('generateMetadata')
    expect(rootLayout).toContain('siteTitle')
    expect(storeLayout).toContain('GoogleAnalytics')
    expect(storeLayout).toContain('googleAnalyticsId')
    expect(productPage).toMatch(/keywords:\s*productKeywords/)
  })

  it('offers direct owner shortcuts and a real storefront preview editor', () => {
    const dashboard = readFileSync(resolve(process.cwd(), 'src/app/admin/page.tsx'), 'utf8')
    const settings = readFileSync(resolve(process.cwd(), 'src/app/admin/settings/page.tsx'), 'utf8')

    expect(dashboard).toContain('admin-quick-actions')
    expect(dashboard).toContain('新增商品')
    expect(dashboard).toContain('回覆訂單留言')
    expect(settings).toContain('BannerSettingsEditor')
  })
})

describe('VariantPicker', () => {
  function CartImageProbe() {
    const { items } = useCart()
    return createElement('output', { 'data-testid': 'cart-image' }, items[0]?.imageUrl ?? '')
  }

  function renderPicker(catalogProduct = product, withProbe = false) {
    return render(createElement(CartProvider, null,
      createElement(ProductColorProvider, { initialColor: catalogProduct.variants[0]?.color ?? '' },
        createElement(VariantPicker, { product: catalogProduct }),
        withProbe ? createElement(CartImageProbe) : null,
      ),
    ))
  }

  it('presents scheduled availability as a clear coming-soon notice', () => {
    renderPicker({ ...product, availableAt: '2099-01-01T00:00:00.000Z' })

    expect(screen.getByRole('button', { name: '尚未開放購買' })).toBeDisabled()
  })

  it('lets a shopper request a restock notice for a sold-out product', () => {
    const soldOutProduct = { ...product, variants: product.variants.map((variant) => ({ ...variant, stock: 0 })) }
    renderPicker(soldOutProduct)

    fireEvent.click(screen.getByRole('button', { name: '貨到通知我' }))

    expect(screen.getByRole('button', { name: '已登記到貨通知' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '商品已售完' })).not.toBeInTheDocument()
  })

  it('derives sizes from the selected color and disables unavailable variants', () => {
    renderPicker()

    expect(screen.queryByRole('button', { name: '尺寸 110' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '尺寸 120（缺貨）' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '加入購物車' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '顏色 珊瑚粉' }))
    expect(screen.getByRole('button', { name: '尺寸 110' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '尺寸 100' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '尺寸 110' }))
    expect(screen.getByRole('button', { name: '加入購物車' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('尺寸已選擇，可以加入購物車')
  })

  it('confirms the add action and announces it to the cart', () => {
    const onCartAdded = vi.fn()
    window.addEventListener('mori:cart-added', onCartAdded)

    renderPicker(product, true)
    fireEvent.click(screen.getByRole('button', { name: '顏色 珊瑚粉' }))
    fireEvent.click(screen.getByRole('button', { name: '尺寸 110' }))
    fireEvent.click(screen.getByRole('button', { name: '加入購物車' }))

    expect(screen.getByRole('button', { name: '已加入購物車' })).toHaveAttribute(
      'data-cart-state',
      'added',
    )
    expect(screen.getByTestId('cart-image')).toHaveTextContent('/pink.jpg')
    expect(onCartAdded).toHaveBeenCalledTimes(1)
    window.removeEventListener('mori:cart-added', onCartAdded)
  })
})
