import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { sendRestockNoticeEmail } from '@/lib/email/restock-notice'

type ProductRow = {
  id: string
  name: string
  slug: string
  is_published: boolean
  product_variants: Array<{ stock: number; price: number; is_active: boolean }>
  product_images: Array<{ storage_path: string; position: number }>
}

function imageUrl(storagePath: string | undefined) {
  if (!storagePath) return null
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const encoded = storagePath.split('/').map(encodeURIComponent).join('/')
  return `${baseUrl}/storage/v1/object/public/product-images/${encoded}`
}

/**
 * Mails everyone waiting on a product that is published and back in stock, then
 * marks the request notified.
 *
 * Runs from the daily cron rather than the product-save path: Hobby plans allow
 * a single cron, and a stock edit should never be slowed down (or rolled back)
 * by an email provider.
 */
export async function notifyRestockedProducts(
  admin: SupabaseClient<Database>,
  limit = 100,
) {
  const { data: pending, error } = await admin
    .from('restock_requests')
    .select('id, email, product_id')
    .is('notified_at', null)
    .order('created_at')
    .limit(limit)
  if (error || !pending?.length) return { sent: 0, waiting: 0 }

  const productIds = [...new Set(pending.map((request) => String(request.product_id)))]
  const { data: products } = await admin
    .from('products')
    .select('id, name, slug, is_published, product_variants(stock, price, is_active), product_images(storage_path, position)')
    .in('id', productIds)

  const backInStock = new Map<string, { name: string; slug: string; price: number; imageUrl: string | null }>()
  for (const row of (products ?? []) as unknown as ProductRow[]) {
    if (!row.is_published) continue
    const active = row.product_variants.filter((variant) => variant.is_active)
    const inStock = active.filter((variant) => variant.stock > 0)
    if (inStock.length === 0) continue
    const image = [...row.product_images].sort((left, right) => left.position - right.position)[0]
    backInStock.set(row.id, {
      name: row.name,
      slug: row.slug,
      price: Math.min(...inStock.map((variant) => variant.price)),
      imageUrl: imageUrl(image?.storage_path),
    })
  }

  let sent = 0
  for (const request of pending) {
    const product = backInStock.get(String(request.product_id))
    if (!product) continue

    // Claim first so an overlapping run cannot mail the same person twice.
    const { data: claimed } = await admin
      .from('restock_requests')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', request.id)
      .is('notified_at', null)
      .select('id')
    if (!claimed?.length) continue

    const result = await sendRestockNoticeEmail({
      email: String(request.email),
      productName: product.name,
      productSlug: product.slug,
      price: product.price,
      imageUrl: product.imageUrl,
    })
    if (result.status === 'sent') {
      sent += 1
    } else {
      // Release the claim so the next run retries.
      await admin.from('restock_requests').update({ notified_at: null }).eq('id', request.id)
    }
  }

  return { sent, waiting: pending.length - sent }
}
