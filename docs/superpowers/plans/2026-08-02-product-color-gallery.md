# Product Color Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the desktop product detail presentation and let shoppers switch the gallery and cart image by selecting a product color configured per image in the admin.

**Architecture:** Add a nullable `color` association to `product_images`, expose it through catalog/admin repositories, and keep database validation inside admin-only RPCs. A small pure image-selection helper and a shared product-color React context coordinate `ProductGallery` and `VariantPicker`; existing products with unassigned images continue to show their full galleries.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase PostgreSQL/RPC/Storage, Vitest Testing Library, Playwright, Vercel.

## Global Constraints

- Preserve the existing mori pale blue-gray palette and established product-page structure.
- Desktop main gallery width is capped near `29rem`; mobile remains full-width and single-column.
- Product images use `object-fit: contain` so clothing is not cropped.
- `product_images.color = null` means a shared image.
- Color choices come only from active product variants; do not add a separate color-management system.
- A selected color shows its matching images first, followed by shared images; if no matching image exists, show the original complete gallery.
- Preserve gallery ordering, zoom, arrows, touch swipe, image reordering, deletion, and reduced-motion behavior.
- Existing images remain visible after migration and default to shared.
- Use Node 24 commands via `PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH`.
- Apply Supabase migrations with dry-run first; production completion requires Vercel `READY` and alias `https://moribebe.com`.

---

### Task 1: Product Image Color Selection Domain

**Files:**
- Create: `src/features/catalog/product-images.ts`
- Modify: `src/features/catalog/queries.ts`
- Modify: `src/testing/e2e-storefront-fixtures.ts`
- Test: `tests/unit/product-images.test.ts`

**Interfaces:**
- Produces: `CatalogProductImage = { url: string; alt: string; color: string | null }`.
- Produces: `imagesForColor(images: readonly CatalogProductImage[], color: string): CatalogProductImage[]`.
- Produces: `primaryImageForColor(images: readonly CatalogProductImage[], color: string): CatalogProductImage | undefined`.

- [ ] **Step 1: Write the failing image-selection tests**

```ts
import { describe, expect, it } from 'vitest'
import { imagesForColor, primaryImageForColor } from '@/features/catalog/product-images'

const images = [
  { url: '/blue-1.jpg', alt: '藍色正面', color: '藍色' },
  { url: '/shared.jpg', alt: '布料細節', color: null },
  { url: '/gray-1.jpg', alt: '灰色正面', color: '灰色' },
  { url: '/blue-2.jpg', alt: '藍色背面', color: '藍色' },
]

describe('imagesForColor', () => {
  it('keeps matching images in order and appends shared images', () => {
    expect(imagesForColor(images, '藍色').map((image) => image.url))
      .toEqual(['/blue-1.jpg', '/blue-2.jpg', '/shared.jpg'])
  })

  it('falls back to the original gallery when a color has no image', () => {
    expect(imagesForColor(images, '粉色')).toEqual(images)
  })

  it('uses the first matching image as the selected-color primary image', () => {
    expect(primaryImageForColor(images, '灰色')?.url).toBe('/gray-1.jpg')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec vitest run tests/unit/product-images.test.ts
```

Expected: FAIL because `@/features/catalog/product-images` does not exist.

- [ ] **Step 3: Implement the focused image type and selectors**

```ts
export type CatalogProductImage = {
  url: string
  alt: string
  color: string | null
}

export function imagesForColor(
  images: readonly CatalogProductImage[],
  color: string,
): CatalogProductImage[] {
  const matching = images.filter((image) => image.color === color)
  if (matching.length === 0) return [...images]
  return [...matching, ...images.filter((image) => image.color === null)]
}

export function primaryImageForColor(
  images: readonly CatalogProductImage[],
  color: string,
) {
  return imagesForColor(images, color)[0]
}
```

Update `CatalogProduct.images`, `ProductRecord.product_images`, the Supabase select list, and `mapProduct`:

```ts
images?: readonly CatalogProductImage[]

product_images: Array<{
  storage_path: string
  alt_text: string
  position: number
  color: string | null
}>

product_images(storage_path, alt_text, position, color)

.map((image) => ({
  url: publicImageUrl(image.storage_path),
  alt: image.alt_text || record.name,
  color: image.color,
}))
```

Add `color: null` to fixture gallery images so legacy behavior is explicit.

- [ ] **Step 4: Run focused tests**

Run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec vitest run tests/unit/product-images.test.ts tests/unit/catalog-review.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/catalog/product-images.ts src/features/catalog/queries.ts src/testing/e2e-storefront-fixtures.ts tests/unit/product-images.test.ts
git commit -m "feat: add product image color selection"
```

### Task 2: Product Image Color Migration and Generated Types

**Files:**
- Create: `supabase/migrations/20260802010000_product_image_colors.sql`
- Modify: `src/types/database.ts`
- Test: `tests/integration/product-image-color-migration.test.ts`

**Interfaces:**
- Produces: nullable `public.product_images.color text`.
- Produces: `admin_insert_product_image(uuid, text, text, text)` with color validation.
- Produces: `admin_set_product_image_color(uuid, uuid, text)` for an authenticated admin.

- [ ] **Step 1: Write the failing migration contract test**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260802010000_product_image_colors.sql'),
  'utf8',
)

describe('product image color migration', () => {
  it('adds a nullable color and protects both image mutations with admin checks', () => {
    expect(sql).toMatch(/alter table public\.product_images[\s\S]*add column color text/i)
    expect(sql).toContain('admin_insert_product_image')
    expect(sql).toContain('admin_set_product_image_color')
    expect(sql.match(/if not public\.is_admin\(\)/gi)).toHaveLength(2)
    expect(sql).toContain('product_image_color_invalid')
    expect(sql).toContain('grant execute')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec vitest run tests/integration/product-image-color-migration.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Add the migration**

```sql
alter table public.product_images
add column color text;

alter table public.product_images
add constraint product_images_color_not_blank
check (color is null or btrim(color) <> '');

create or replace function public.admin_insert_product_image(
  p_product_id uuid,
  p_storage_path text,
  p_alt_text text,
  p_color text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  image_id uuid;
  next_position integer;
  normalized_color text := nullif(btrim(p_color), '');
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if btrim(p_storage_path) = '' or btrim(p_alt_text) = '' then
    raise exception 'image_data_required';
  end if;
  if normalized_color is not null and not exists (
    select 1 from public.product_variants
    where product_id = p_product_id and is_active and color = normalized_color
  ) then
    raise exception 'product_image_color_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text, 0));
  select coalesce(max(position), -1) + 1 into next_position
  from public.product_images where product_id = p_product_id;
  insert into public.product_images (product_id, storage_path, alt_text, position, color)
  values (p_product_id, p_storage_path, btrim(p_alt_text), next_position, normalized_color)
  returning id into image_id;
  return image_id;
end;
$$;

create or replace function public.admin_set_product_image_color(
  p_product_id uuid,
  p_image_id uuid,
  p_color text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_color text := nullif(btrim(p_color), '');
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if normalized_color is not null and not exists (
    select 1 from public.product_variants
    where product_id = p_product_id and is_active and color = normalized_color
  ) then
    raise exception 'product_image_color_invalid';
  end if;
  update public.product_images
  set color = normalized_color, updated_at = clock_timestamp()
  where id = p_image_id and product_id = p_product_id;
  if not found then raise exception 'image_not_found'; end if;
end;
$$;

revoke all on function public.admin_insert_product_image(uuid, text, text, text) from public, anon;
revoke all on function public.admin_set_product_image_color(uuid, uuid, text) from public, anon;
grant execute on function public.admin_insert_product_image(uuid, text, text, text) to authenticated;
grant execute on function public.admin_set_product_image_color(uuid, uuid, text) to authenticated;
```

Keep the existing three-argument insert RPC available until the application deployment finishes; do not drop it in this migration.

- [ ] **Step 4: Update database TypeScript types**

Add `color: string | null` to `product_images.Row`, `color?: string | null` to `Insert`/`Update`, add `p_color: string | null` to `admin_insert_product_image.Args`, and add:

```ts
admin_set_product_image_color: {
  Args: { p_color: string | null; p_image_id: string; p_product_id: string }
  Returns: undefined
}
```

- [ ] **Step 5: Run migration and type-focused tests**

Run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec vitest run tests/integration/product-image-color-migration.test.ts
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec tsc --noEmit
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260802010000_product_image_colors.sql src/types/database.ts tests/integration/product-image-color-migration.test.ts
git commit -m "feat: store product image colors"
```

### Task 3: Admin Image Color Actions

**Files:**
- Modify: `src/lib/validation/product.ts`
- Modify: `src/features/admin/product-actions.ts`
- Test: `tests/integration/admin-products.test.ts`

**Interfaces:**
- Changes: `ProductRepository.insertImage(productId, path, alt, color)`.
- Produces: `ProductRepository.setImageColor(productId, imageId, color)`.
- Produces: `updateProductImageColor(productId, imageId, color): Promise<ActionResult>` server action.
- Changes: create/upload/adopt flows accept `color: string | null`.

- [ ] **Step 1: Add failing action tests**

Extend `MemoryProductRepository` to record inserted and updated colors, then add:

```ts
it('stores an allowed color while uploading a product image', async () => {
  const { actions, repository } = setup()
  const result = await actions.uploadProductImage(productId, {
    alt: '黃色上衣正面', color: '黃色', file: imageFile('image/png'),
  })
  expect(result.ok).toBe(true)
  expect(repository.events).toContain(expect.stringMatching(/insert-image:.*:黃色$/))
})

it('updates an existing image color and reports an invalid color', async () => {
  const { actions, repository } = setup()
  expect((await actions.updateProductImageColor(productId, 'image-1', '黃色')).ok).toBe(true)
  repository.failImageColor = true
  expect(await actions.updateProductImageColor(productId, 'image-1', '不存在'))
    .toMatchObject({ ok: false, message: '這個顏色已不在商品規格中，請重新選擇' })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec vitest run tests/integration/admin-products.test.ts
```

Expected: FAIL because image color repository/action interfaces are missing.

- [ ] **Step 3: Extend validation and repository actions**

```ts
export const productImageSchema = z.object({
  alt: z.string().trim().min(1, '圖片替代文字為必填'),
  color: z.string().trim().max(80, '圖片顏色過長').nullable().default(null),
  file: imageFileSchema,
}).strict()
```

Add repository methods:

```ts
insertImage(productId: string, path: string, alt: string, color: string | null): Promise<void>
setImageColor(productId: string, imageId: string, color: string | null): Promise<void>
```

The Supabase implementation calls:

```ts
await supabase.rpc('admin_insert_product_image', {
  p_product_id: productId,
  p_storage_path: path,
  p_alt_text: alt,
  p_color: color,
})

await supabase.rpc('admin_set_product_image_color', {
  p_product_id: productId,
  p_image_id: imageId,
  p_color: color,
})
```

The fixture implementation updates the matching in-memory image after verifying `color === null || product.variants.some((variant) => variant.color === color)`.

- [ ] **Step 4: Add the action and FormData plumbing**

```ts
async updateProductImageColor(productId: string, imageId: string, color: string | null) {
  await dependencies.requireAdmin()
  const id = productIdSchema.safeParse(productId)
  const imageIdResult = imageIdSchema.safeParse(imageId)
  if (!id.success || !imageIdResult.success) return { ok: false, message: '商品圖片不存在' }
  try {
    await dependencies.repository.setImageColor(id.data, imageIdResult.data, color?.trim() || null)
  } catch (error) {
    if (databaseErrorMessage(error).includes('product_image_color_invalid')) {
      return { ok: false, message: '這個顏色已不在商品規格中，請重新選擇' }
    }
    return { ok: false, message: '目前無法更新圖片顏色，請稍後再試' }
  }
  await refreshAfterMutation(id.data)
  return { ok: true, productId: id.data, message: '圖片顏色已更新' }
}
```

Parse `imageColors` as a JSON array in `createProductWithImage`; pass the color at the same file/draft index to `uploadProductImage` and `adoptDraftImage`. Pass `formData.get('color') || null` in the standalone upload action.

- [ ] **Step 5: Run admin tests**

Run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec vitest run tests/integration/admin-products.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation/product.ts src/features/admin/product-actions.ts tests/integration/admin-products.test.ts
git commit -m "feat: manage product image colors"
```

### Task 4: Admin Color Assignment UI

**Files:**
- Modify: `src/features/admin/product-form.tsx`
- Modify: `src/features/admin/image-uploader.tsx`
- Modify: `src/app/admin/products/[id]/edit/page.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/integration/admin-products.test.ts`
- Test: `tests/e2e/local-admin-product.spec.ts`

**Interfaces:**
- Consumes: unique colors from `ProductInput.variants`.
- Consumes: `updateProductImageColor` and the color-aware upload action from Task 3.
- Produces: one `對應顏色` select per new/existing image; empty value means shared.

- [ ] **Step 1: Add failing component tests**

```ts
it('lets the owner assign each selected new image to a variant color', () => {
  const view = render(createElement(ProductForm, {
    initialProduct: newProduct, onSave: vi.fn(), requireImage: true,
  }))
  fireEvent.change(within(view.container).getByLabelText('商品圖片'), {
    target: { files: [imageFile('image/png'), imageFile('image/png')] },
  })
  expect(within(view.container).getAllByLabelText(/圖片 \d+ 對應顏色/)).toHaveLength(2)
  expect(within(view.container).getAllByRole('option', { name: '黃色' }).length).toBeGreaterThan(0)
})

it('includes a shared-image color option in the standalone uploader', () => {
  render(createElement(ImageUploader, { upload: vi.fn(), colors: ['黃色', '藍色'] }))
  expect(screen.getByLabelText('對應顏色')).toHaveValue('')
  expect(screen.getByRole('option', { name: '共用圖片' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec vitest run tests/integration/admin-products.test.ts
```

Expected: FAIL because image color controls do not exist.

- [ ] **Step 3: Add per-image selectors to the create form**

Maintain an `imageColors: Array<string | null>` state aligned with the displayed file/draft preview order. When images are added or removed, add/remove the same color index. Before save:

```ts
imageData.set('imageColors', JSON.stringify(imageColors))
```

Render under each preview:

```tsx
<label>
  圖片 {index + 1} 對應顏色
  <select value={imageColors[index] ?? ''} onChange={(event) => updateImageColor(index, event.target.value || null)}>
    <option value="">共用圖片</option>
    {productColors.map((color) => <option key={color} value={color}>{color}</option>)}
  </select>
</label>
```

- [ ] **Step 4: Add color controls to upload and edit cards**

Change `ImageUploader` to accept `colors: readonly string[]` and submit a `name="color"` select. In the edit page, derive colors with:

```ts
const colors = [...new Set(product.product.variants.map((variant) => variant.color))]
```

Pass `colors` to `ImageUploader`. Add a small client form beside every existing image whose server action is `updateProductImageColor.bind(null, productId, image.id)`; it shows the current value, `共用圖片`, active colors, and an unavailable legacy value when necessary.

- [ ] **Step 5: Style only the new controls**

Add selectors beside `.admin-product-image-grid` and `.admin-create-image-previews` so the color select uses the existing pale field background, 1px line border, `0.68rem` label text, and a minimum touch height of `2.5rem`. Do not change unrelated admin cards.

- [ ] **Step 6: Extend the local admin browser test**

After creating two images, assert both color selectors exist, set the first to `森林綠`, save, reload, and verify the selected value persists before continuing the existing reorder/delete assertions.

- [ ] **Step 7: Run component and local-admin tests**

Run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec vitest run tests/integration/admin-products.test.ts
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec playwright test tests/e2e/local-admin-product.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/admin/product-form.tsx src/features/admin/image-uploader.tsx 'src/app/admin/products/[id]/edit/page.tsx' src/app/globals.css tests/integration/admin-products.test.ts tests/e2e/local-admin-product.spec.ts
git commit -m "feat: assign colors to product images"
```

### Task 5: Shared Product Color State and Gallery Switching

**Files:**
- Create: `src/features/catalog/product-color-context.tsx`
- Modify: `src/features/catalog/product-gallery.tsx`
- Modify: `src/features/catalog/variant-picker.tsx`
- Modify: `src/app/(store)/products/[slug]/page.tsx`
- Test: `tests/unit/product-gallery.test.tsx`
- Test: `tests/unit/filters.test.ts`

**Interfaces:**
- Produces: `ProductColorProvider({ initialColor, children })`.
- Produces: `useProductColor(): { color: string; setColor(color: string): void }`.
- Consumes: `imagesForColor` and `primaryImageForColor` from Task 1.

- [ ] **Step 1: Add failing interaction tests**

```tsx
it('switches the gallery when a shopper chooses a color', () => {
  render(
    <CartProvider>
      <ProductColorProvider initialColor="藍色">
        <ProductGallery images={images} isNew={false} />
        <VariantPicker product={product} />
      </ProductColorProvider>
    </CartProvider>,
  )
  expect(screen.getByRole('img', { name: '藍色正面' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '顏色 灰色' }))
  expect(screen.getByRole('img', { name: '灰色正面' })).toBeInTheDocument()
})

it('adds the selected color image to cart', () => {
  // Select 灰色 and a size, add to cart, then assert the stored item imageUrl is /gray-1.jpg.
})
```

Implement the second test with a small cart-state observer component that reads `useCart().state.items[0]?.imageUrl` and exposes it via `data-testid="cart-image"`.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec vitest run tests/unit/product-gallery.test.tsx tests/unit/filters.test.ts
```

Expected: FAIL because the shared color provider is missing and the gallery does not filter images.

- [ ] **Step 3: Add the shared color context**

```tsx
'use client'

import { createContext, useContext, useMemo, useState } from 'react'

type ProductColorValue = { color: string; setColor: (color: string) => void }
const ProductColorContext = createContext<ProductColorValue | null>(null)

export function ProductColorProvider({ initialColor, children }: {
  initialColor: string
  children: React.ReactNode
}) {
  const [color, setColor] = useState(initialColor)
  const value = useMemo(() => ({ color, setColor }), [color])
  return <ProductColorContext.Provider value={value}>{children}</ProductColorContext.Provider>
}

export function useProductColor() {
  const value = useContext(ProductColorContext)
  if (!value) throw new Error('ProductColorProvider is required')
  return value
}
```

- [ ] **Step 4: Connect gallery, variant picker, page, and cart image**

Immediately before the existing product `<section className="section product-page">`, add the provider opening tag:

```tsx
<ProductColorProvider initialColor={product.variants[0]?.color ?? ''}>
  <section className="section product-page">
```

Immediately after that section's existing closing `</section>`, add `</ProductColorProvider>`.

In `ProductGallery`, derive `visibleImages = imagesForColor(images, color)`, reset `active` to `0` when `color` changes, and use `visibleImages` for arrows, counter, thumbnails, swipe, zoom and active image.

In `VariantPicker`, replace local color state with `useProductColor()`. On color click call `setColor(choice)` and clear size. For cart:

```ts
const selectedImage = primaryImageForColor(product.images ?? [], color)

imageUrl: selectedImage?.url ?? product.imageUrl,
```

- [ ] **Step 5: Run interaction tests**

Run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec vitest run tests/unit/product-gallery.test.tsx tests/unit/filters.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/catalog/product-color-context.tsx src/features/catalog/product-gallery.tsx src/features/catalog/variant-picker.tsx 'src/app/(store)/products/[slug]/page.tsx' tests/unit/product-gallery.test.tsx tests/unit/filters.test.ts
git commit -m "feat: switch gallery by product color"
```

### Task 6: Compact Product Detail Layout

**Files:**
- Modify: `src/app/globals.css`
- Test: `tests/e2e/accessibility.spec.ts`
- Test: `tests/e2e/analytics-and-sharing.spec.ts`

**Interfaces:**
- Changes only product-detail CSS at desktop breakpoints.
- Preserves the existing mobile single-column breakpoint.

- [ ] **Step 1: Add a failing desktop layout assertion**

Add a desktop test that navigates to a product and checks:

```ts
const gallery = page.locator('.product-gallery-main')
const box = await gallery.boundingBox()
expect(box).not.toBeNull()
expect(box!.width).toBeLessThanOrEqual(470)
await expect(gallery.locator('.product-image')).toHaveCSS('object-fit', 'contain')
```

Keep the existing mobile viewport assertion that the product page is single-column and does not overflow horizontally.

- [ ] **Step 2: Run the browser test and verify it fails**

Run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec playwright test tests/e2e/analytics-and-sharing.spec.ts
```

Expected: FAIL because the current gallery width is `34rem` and the image is `cover`.

- [ ] **Step 3: Apply the compact desktop sizing**

```css
.product-detail-page .section { padding-block: clamp(2rem, 4vw, 4rem); }
.product-page {
  width: min(100% - 2rem, 74rem);
  grid-template-columns: minmax(0, 0.92fr) minmax(19rem, 1.08fr);
  gap: clamp(2rem, 4vw, 4.25rem);
}
.product-gallery-main,
.product-gallery-thumbnails { width: min(100%, 29rem); }
.product-gallery-main { max-height: 72vh; }
.product-gallery-main .product-image { object-fit: contain; }
.product-title-row h1 { max-width: 10em; font-size: clamp(2.35rem, 4.4vw, 4.6rem); }
```

Inside the existing mobile breakpoint, restore:

```css
.product-page { width: min(100% - 1.25rem, 84rem); }
.product-gallery-main,
.product-gallery-thumbnails { width: 100%; }
.product-gallery-main { max-height: none; }
```

Use a neutral `var(--oat)` letterbox background; do not introduce new palette tokens.

- [ ] **Step 4: Run desktop and mobile browser checks**

Run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec playwright test tests/e2e/analytics-and-sharing.spec.ts tests/e2e/accessibility.spec.ts
```

Expected: PASS at desktop and mobile project viewports.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css tests/e2e/analytics-and-sharing.spec.ts tests/e2e/accessibility.spec.ts
git commit -m "style: compact product detail layout"
```

### Task 7: Full Verification, Supabase Release, Push, and Production Deploy

**Files:**
- Verify: all files changed in Tasks 1–6.
- No unrelated dirty files may be staged.

**Interfaces:**
- Consumes the completed migration, admin UI, storefront interaction and CSS.
- Produces the production release at `https://moribebe.com`.

- [ ] **Step 1: Run static and complete automated verification**

Run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec eslint src tests
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec vitest run
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec playwright test
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm build
```

Expected: all commands exit `0`. If a project-wide unrelated failure exists, record it accurately and still run focused tests for every changed surface; do not claim a clean global check.

- [ ] **Step 2: Inspect the final diff**

Run:

```bash
git diff --check
git status --short
git diff --stat origin/feat/mori-store...HEAD
```

Expected: no whitespace errors; only color-gallery/spec/plan files are intended for commit. Preserve `next-env.d.ts`, `tsconfig.tsbuildinfo`, `.playwright-cli/*`, and unrelated plan files unless this implementation changed them deliberately.

- [ ] **Step 3: Dry-run and apply the Supabase migration**

Run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm dlx supabase@latest db push --dry-run
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm dlx supabase@latest db push
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm dlx supabase@latest migration list
```

Expected: dry-run lists only pending intended migrations, apply succeeds, and `20260802010000` appears on both local and remote migration lists.

- [ ] **Step 4: Push and verify the remote commit**

Run:

```bash
git push origin feat/mori-store
git fetch origin feat/mori-store
git rev-parse HEAD
git rev-parse origin/feat/mori-store
```

Expected: local and remote SHAs match exactly.

- [ ] **Step 5: Deploy the exact commit to production**

Create a clean temporary archive from `HEAD`, copy `.vercel/project.json`, then run:

```bash
PATH=/Users/shuo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm dlx vercel@latest deploy <clean-archive-path> --prod -y
```

Expected output includes `Production`, `Aliased https://moribebe.com`, and JSON with `"readyState": "READY"` and `"target": "production"`.

- [ ] **Step 6: Record release evidence**

Report the migration version, final commit SHA, passing verification commands, Vercel deployment ID, production alias, and any unrelated preserved workspace changes.
