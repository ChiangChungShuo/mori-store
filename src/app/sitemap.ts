import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/site'
import { listProducts } from '@/features/catalog/queries'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/products'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/faq'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/order-lookup'), changeFrequency: 'monthly', priority: 0.4 },
    { url: absoluteUrl('/returns'), changeFrequency: 'yearly', priority: 0.3 },
    { url: absoluteUrl('/privacy'), changeFrequency: 'yearly', priority: 0.3 },
    { url: absoluteUrl('/terms'), changeFrequency: 'yearly', priority: 0.3 },
    { url: absoluteUrl('/contact'), changeFrequency: 'yearly', priority: 0.3 },
  ]

  let productRoutes: MetadataRoute.Sitemap = []
  try {
    const products = await listProducts({})
    productRoutes = products.map((product) => ({
      url: absoluteUrl(`/products/${product.slug}`),
      changeFrequency: 'weekly',
      priority: 0.7,
    }))
  } catch {
    productRoutes = []
  }

  return [...staticRoutes, ...productRoutes]
}
