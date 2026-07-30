# 商品分類與系列導覽實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在既有商品分類下加入可由後台管理的第二層「系列」，讓商品可勾選同分類內的多個系列，並讓顧客從桌機雙欄選單、手機巢狀選單及商品列表篩選查看特定系列。

**Architecture:** `product_series` 保存分類專屬系列，`product_series_products` 保存商品與系列的多對多關聯；資料庫 trigger 與商品儲存服務雙重驗證分類一致。正式環境使用 Supabase，現有本機示範模式在 `E2EStoreState` 保存同型資料。前台只透過共用 `listProductSeries` 與 catalog query 讀取，不直接判斷資料來源。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Supabase/PostgreSQL、Zod、Vitest、Testing Library、Playwright、CSS。

## Global Constraints

- 系列隸屬單一分類；同一分類內名稱不分大小寫唯一，最多 40 個字。
- 商品可以不選系列，也能同時選擇目前分類下的多個系列。
- 商品換分類時，前端立即清除舊系列；伺服器及資料庫仍要再次驗證。
- 商品刪除時關聯可連帶刪除；系列仍被商品使用時必須拒絕刪除。
- 既有商品、訂單快照、庫存與草稿不可因 migration 遺失或改值。
- `series` URL 條件只有與 `category` 同時存在才生效。
- 既有 `q`、`age`、`size`、`color`、`inStock` 條件要能與系列組合。
- 不新增系列形象頁、封面圖、商品卡標籤、跨分類系列或拖曳排序。
- 沿用現有淡藍灰、白色與深色文字；桌機及 375px 手機不可水平溢出。
- 所有功能先寫失敗測試，再做最小實作；每個任務完成後只提交該任務檔案。
- 不碰工作區既有的 `src/app/admin/layout.tsx`、`src/components/toast.tsx` 與不屬於本功能的樣式變更，除非執行時確認本功能確實需要同一段 CSS，且先保存使用者改動。

---

## File Map

### New files

- `supabase/migrations/202607310001_product_series.sql`：系列、關聯表、限制、索引、RLS 與分類一致 trigger。
- `supabase/migrations/202607310002_product_series_assignments.sql`：商品新增／編輯 RPC 原子同步系列關聯。
- `src/features/catalog/product-series.ts`：系列型別、正式／fixture repository、查詢與後台 action。
- `src/features/admin/series-manager.tsx`：分類專屬系列新增、排序、刪除介面。
- `src/components/category-series-menu.tsx`：桌機雙欄與手機巢狀系列導覽的共用資料呈現。
- `tests/integration/product-series.test.ts`：系列領域規則及後台 action。
- `tests/integration/product-series-migration.test.ts`：schema、限制、RLS、trigger 與 RPC 合約。
- `tests/unit/category-series-menu.test.tsx`：桌機與手機導覽互動。
- `tests/e2e/category-series-navigation.spec.ts`：老闆設定到顧客篩選的完整流程。

### Modified files

- `src/types/database.ts`：新增兩張資料表及關聯型別。
- `src/testing/e2e-store.ts`、`src/testing/e2e-storefront-fixtures.ts`：本機系列與商品關聯種子。
- `src/app/admin/categories/page.tsx`、`src/features/admin/category-manager.tsx`：掛載系列管理及分類被系列使用時的提示。
- `src/lib/validation/product.ts`：商品輸入增加 `seriesIds`。
- `src/features/admin/product-form.tsx`：同分類系列多選與換分類清除。
- `src/features/admin/product-actions.ts`：新增、編輯、讀取商品系列。
- `src/app/admin/products/new/page.tsx`、`src/app/admin/products/[id]/edit/page.tsx`：取得系列並傳入表單。
- `src/features/catalog/queries.ts`：系列查詢參數、關聯 mapping 與篩選。
- `src/features/catalog/product-filters.tsx`：其他條件送出時保留合法系列。
- `src/app/(store)/products/page.tsx`：分類下方的系列切換列與空狀態。
- `src/app/(store)/layout.tsx`、`src/components/site-header.tsx`：載入並顯示系列導覽。
- `src/app/globals.css`：雙欄面板、手機巢狀選單、系列管理與多選欄位樣式。
- `tests/integration/admin-products.test.ts`、`tests/unit/product-validation.test.ts`：商品系列表單與儲存。
- `tests/unit/filters.test.ts`、`tests/unit/store-schema.test.ts`：查詢及 schema 回歸。
- `tests/unit/cart.test.ts`：補齊 `CatalogProduct.series` 測試資料。
- `tests/unit/storefront-header-contract.test.ts`、`tests/e2e/accessibility.spec.ts`：導覽合約與鍵盤操作。

---

## Task 1: 建立系列資料模型與共用查詢

**Files:**
- Create: `supabase/migrations/202607310001_product_series.sql`
- Create: `src/features/catalog/product-series.ts`
- Modify: `src/types/database.ts`
- Modify: `src/testing/e2e-store.ts`
- Modify: `src/testing/e2e-storefront-fixtures.ts`
- Create: `tests/integration/product-series-migration.test.ts`
- Create: `tests/integration/product-series.test.ts`

**Interfaces:**

```ts
export type ProductSeries = {
  id: string
  categoryName: string
  name: string
  position: number
}

export interface ProductSeriesRepository {
  list(categoryName?: string): Promise<ProductSeries[]>
  create(categoryName: string, name: string): Promise<void>
  move(id: string, direction: 'up' | 'down'): Promise<void>
  remove(id: string): Promise<void>
}

export function createProductSeriesActions(dependencies: ProductSeriesDependencies): {
  create(categoryName: string, name: string): Promise<SeriesActionState>
  move(id: string, direction: 'up' | 'down'): Promise<SeriesActionState>
  remove(id: string): Promise<SeriesActionState>
}

export async function listProductSeries(categoryName?: string): Promise<ProductSeries[]>
```

- [ ] **Step 1: 寫 migration 合約失敗測試**

在 `tests/integration/product-series-migration.test.ts` 讀取 migration SQL，驗證：

```ts
expect(source).toMatch(/create table public\.product_series/i)
expect(source).toMatch(/create unique index.+lower\(name\)/i)
expect(source).toMatch(/category_name.+references public\.product_categories\(name\)/i)
expect(source).toMatch(/product_id.+on delete cascade/i)
expect(source).toMatch(/series_id.+on delete restrict/i)
expect(source).toMatch(/enable row level security/i)
expect(source).toMatch(/create trigger.+validate_product_series_category/is)
```

- [ ] **Step 2: 寫 repository/action 失敗測試**

在 `tests/integration/product-series.test.ts` 用 memory repository 驗證：

```ts
it('creates a trimmed series inside one category', async () => {
  const result = await actions.create('上衣', '  Mori flora 漫花系列  ')
  expect(result).toEqual({ ok: true, message: '系列「Mori flora 漫花系列」已新增' })
})

it('rejects a case-insensitive duplicate in the same category', async () => {
  await repository.create('上衣', 'Mori flora')
  expect(await actions.create('上衣', 'mori FLORA')).toEqual({
    ok: false,
    message: '這個分類已有相同系列',
  })
})

it('does not delete a series that still has products', async () => {
  repository.remove.mockRejectedValueOnce(new Error('series_in_use'))
  expect(await actions.remove(seriesId)).toEqual({
    ok: false,
    message: '仍有商品使用此系列，請先調整商品系列',
  })
})
```

- [ ] **Step 3: 執行測試並確認 RED**

Run: `pnpm exec vitest run tests/integration/product-series-migration.test.ts tests/integration/product-series.test.ts`

Expected: FAIL，因 migration 與 `product-series.ts` 尚不存在。

- [ ] **Step 4: 建立資料表、限制與 RLS**

`202607310001_product_series.sql` 使用以下核心結構：

```sql
create table public.product_series (
  id uuid primary key default gen_random_uuid(),
  category_name text not null references public.product_categories(name)
    on update cascade on delete restrict,
  name text not null check (btrim(name) <> '' and char_length(name) <= 40),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index product_series_category_name_unique
  on public.product_series (category_name, lower(btrim(name)));
create index product_series_category_position_idx
  on public.product_series (category_name, position, created_at);

create table public.product_series_products (
  product_id uuid not null references public.products(id) on delete cascade,
  series_id uuid not null references public.product_series(id) on delete restrict,
  primary key (product_id, series_id)
);
create index product_series_products_series_idx
  on public.product_series_products (series_id, product_id);
```

新增 `validate_product_series_category()` trigger，比對 `products.category` 與 `product_series.category_name`，不一致時 `raise exception 'product_series_category_mismatch'`。兩表開啟 RLS：公開只讀；管理員以既有 `profiles.role = 'admin'` 條件管理。不要以 junction 的 cascade 掩蓋「使用中不可刪除」規則。

- [ ] **Step 5: 補齊 TypeScript 型別、fixture state 與 repository**

在 `Database['public']['Tables']` 加入兩表 Row/Insert/Update/Relationships。`E2EStoreState` 增加：

```ts
productSeries: ProductSeries[]
productSeriesProducts: Array<{ productId: string; seriesId: string }>
```

fixture 種子至少建立：

```ts
[
  { id: '10000000-0000-4000-8000-000000000001', categoryName: '上衣', name: 'Mori flora 漫花系列', position: 0 },
  { id: '10000000-0000-4000-8000-000000000002', categoryName: '上衣', name: 'Mori forest 森林系列', position: 1 },
  { id: '10000000-0000-4000-8000-000000000003', categoryName: '褲裝', name: 'Mori daily 日常系列', position: 0 },
]
```

`listProductSeries()` 無 Supabase 設定時回傳空陣列，不讓未設定本機環境崩潰；fixture mode 回傳 store 資料；正式環境依 `category_name, position, created_at` 排序。

- [ ] **Step 6: 執行 focused tests 與型別檢查**

Run: `pnpm exec vitest run tests/integration/product-series-migration.test.ts tests/integration/product-series.test.ts tests/unit/e2e-store.test.ts tests/unit/store-schema.test.ts`

Expected: PASS。

Run: `pnpm exec tsc --noEmit`

Expected: PASS。

- [ ] **Step 7: 提交本任務**

```bash
git add supabase/migrations/202607310001_product_series.sql src/features/catalog/product-series.ts src/types/database.ts src/testing/e2e-store.ts src/testing/e2e-storefront-fixtures.ts tests/integration/product-series-migration.test.ts tests/integration/product-series.test.ts
git commit -m "feat: add product series data model"
```

---

## Task 2: 完成後台系列新增、排序與刪除

**Files:**
- Create: `src/features/admin/series-manager.tsx`
- Modify: `src/features/catalog/product-series.ts`
- Modify: `src/app/admin/categories/page.tsx`
- Modify: `src/features/admin/category-manager.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/integration/product-series.test.ts`

**Interfaces:**

```ts
export async function createProductSeriesFromForm(state: SeriesActionState, formData: FormData): Promise<SeriesActionState>
export async function moveProductSeriesFromForm(state: SeriesActionState, formData: FormData): Promise<SeriesActionState>
export async function deleteProductSeriesFromForm(state: SeriesActionState, formData: FormData): Promise<SeriesActionState>
```

- [ ] **Step 1: 寫後台 action 與元件失敗測試**

覆蓋：缺少分類、空名稱、超過 40 字、同分類重複、上移／下移、使用中不可刪除、成功後 revalidate。元件測試驗證分類 select、新增 input、每列上移／下移／刪除按鈕與 `aria-live` 訊息。

- [ ] **Step 2: 執行測試並確認 RED**

Run: `pnpm exec vitest run tests/integration/product-series.test.ts`

Expected: FAIL，因 server actions 與 `SeriesManager` 尚未完成。

- [ ] **Step 3: 實作 action 與排序**

`move(id, direction)` 先取得同分類排序後清單，與相鄰項交換 `position`；正式 repository 用 admin client 完成兩筆 update，fixture 使用相同排序規則。刪除前先 count junction，非 0 時丟出 `series_in_use`。所有成功操作 revalidate：`/`、`/products`、`/admin/categories`、`/admin/products/new`、`/admin/products`。

- [ ] **Step 4: 實作管理介面**

`AdminCategoriesPage` 同時載入 categories、series、presets，把系列管理放在分類管理下方。`SeriesManager`：先選分類，只顯示該分類系列；新增 form 固定帶 `categoryName`；第一列停用上移，末列停用下移；刪除使用 `aria-label="刪除系列 {name}"`。分類刪除若有系列，沿用「仍有商品或系列使用此分類」的明確訊息。

- [ ] **Step 5: 加入精準樣式**

只新增 `.admin-series-*`，沿用既有 admin panel、button、input 色票；手機改成單欄，排序按鈕至少 44×44px。不要順手重排其他 admin CSS。

- [ ] **Step 6: 驗證**

Run: `pnpm exec vitest run tests/integration/product-series.test.ts tests/integration/product-categories.test.ts`

Expected: PASS。

Run: `pnpm exec eslint src/features/catalog/product-series.ts src/features/admin/series-manager.tsx src/app/admin/categories/page.tsx src/features/admin/category-manager.tsx`

Expected: PASS。

- [ ] **Step 7: 提交本任務**

```bash
git add src/features/catalog/product-series.ts src/features/admin/series-manager.tsx src/app/admin/categories/page.tsx src/features/admin/category-manager.tsx src/app/globals.css tests/integration/product-series.test.ts
git commit -m "feat: manage product series in admin"
```

---

## Task 3: 讓商品新增、編輯與草稿保存多個系列

**Files:**
- Create: `supabase/migrations/202607310002_product_series_assignments.sql`
- Modify: `src/lib/validation/product.ts`
- Modify: `src/features/admin/product-actions.ts`
- Modify: `src/features/admin/product-form.tsx`
- Modify: `src/app/admin/products/new/page.tsx`
- Modify: `src/app/admin/products/[id]/edit/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/product-validation.test.ts`
- Modify: `tests/integration/admin-products.test.ts`
- Modify: `tests/integration/product-series-migration.test.ts`

- [ ] **Step 1: 寫 validation 與表單失敗測試**

```ts
expect(productSchema.parse({ ...validProduct, seriesIds: [seriesA, seriesB] }).seriesIds)
  .toEqual([seriesA, seriesB])
expect(productSchema.safeParse({ ...validProduct, seriesIds: ['bad-id'] }).success).toBe(false)
```

Testing Library 驗證：選「上衣」只看到上衣系列；可勾選兩個；改成「褲裝」後 `onSave` 收到 `seriesIds: []`；編輯既有商品會顯示已勾選系列。

- [ ] **Step 2: 寫 RPC 合約失敗測試**

驗證第二個 migration 同時：

- 從 `p_product -> 'seriesIds'` 讀 UUID 陣列。
- 拒絕不存在或分類不符的系列。
- update 商品成功後 delete 舊 junction，再 insert 新 junction。
- create 與 update 在同一 transaction/function call 內完成。

- [ ] **Step 3: 執行測試並確認 RED**

Run: `pnpm exec vitest run tests/unit/product-validation.test.ts tests/integration/admin-products.test.ts tests/integration/product-series-migration.test.ts`

Expected: FAIL，因 `seriesIds` 尚未進入 schema、表單與 RPC。

- [ ] **Step 4: 擴充商品輸入與管理頁資料載入**

`productSchema` 加入：

```ts
seriesIds: z.array(z.string().uuid('商品系列格式錯誤')).default([]),
```

新商品預設 `seriesIds: []`。新增／編輯頁並行呼叫 `listProductSeries()`，以 `series` prop 傳給 `ProductForm`。`getAdminProduct()` 正式環境 select junction，fixture 由 store mapping，皆回傳 `seriesIds`。

- [ ] **Step 5: 實作商品表單多選**

分類欄下方顯示同分類系列 checkbox group：

```tsx
<fieldset className="admin-product-series" disabled={!product.category}>
  <legend>商品系列（可複選）</legend>
  {availableSeries.map((series) => (
    <label key={series.id}>
      <input
        checked={product.seriesIds.includes(series.id)}
        type="checkbox"
        onChange={() => toggleSeries(series.id)}
      />
      {series.name}
    </label>
  ))}
</fieldset>
```

`setText('category', value)` 必須同一次 state update 設定新 category 並清空 `seriesIds`；未選分類、沒有系列、驗證錯誤各有明確文案。草稿沿用完整 `ProductInput` JSON，因此不另建第二份草稿欄位。

- [ ] **Step 6: 原子同步正式關聯與 fixture 關聯**

第二個 migration 以目前最新版 `admin_create_product`／`admin_update_product` 為基礎完整 `create or replace`，不要回退 SEO、圖片、上下架排程等既有欄位。更新前用以下判斷拒絕錯誤系列：

```sql
if exists (
  select 1
  from jsonb_array_elements_text(coalesce(p_product -> 'seriesIds', '[]'::jsonb)) requested(id)
  left join public.product_series series on series.id = requested.id::uuid
  where series.id is null or series.category_name <> btrim(p_product ->> 'category')
) then
  raise exception 'product_series_category_mismatch';
end if;
```

商品 upsert 後刪除該商品舊 junction，再以去重後 UUID insert。fixture repository 做相同驗證及替換，錯誤映射成「商品系列與分類不相符，請重新選擇」。

- [ ] **Step 7: 驗證**

Run: `pnpm exec vitest run tests/unit/product-validation.test.ts tests/integration/admin-products.test.ts tests/integration/product-series-migration.test.ts tests/unit/fixture-admin-products.test.ts`

Expected: PASS。

Run: `pnpm exec tsc --noEmit`

Expected: PASS。

- [ ] **Step 8: 提交本任務**

```bash
git add supabase/migrations/202607310002_product_series_assignments.sql src/lib/validation/product.ts src/features/admin/product-actions.ts src/features/admin/product-form.tsx src/app/admin/products/new/page.tsx 'src/app/admin/products/[id]/edit/page.tsx' src/app/globals.css tests/unit/product-validation.test.ts tests/integration/admin-products.test.ts tests/integration/product-series-migration.test.ts
git commit -m "feat: assign multiple series to products"
```

---

## Task 4: 加入商品列表系列條件與切換列

**Files:**
- Modify: `src/features/catalog/queries.ts`
- Modify: `src/features/catalog/product-filters.tsx`
- Modify: `src/app/(store)/products/page.tsx`
- Modify: `src/testing/e2e-storefront-fixtures.ts`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/filters.test.ts`
- Modify: `tests/unit/cart.test.ts`
- Modify: `tests/e2e/catalog.spec.ts`

**Interfaces:**

```ts
export type ProductFilters = {
  q?: string
  age?: string
  size?: string
  color?: string
  category?: string
  series?: string
  inStock?: boolean
}

export type CatalogProduct = {
  // existing fields
  series: readonly Pick<ProductSeries, 'id' | 'categoryName' | 'name' | 'position'>[]
}
```

- [ ] **Step 1: 寫查詢與組合篩選失敗測試**

在 `tests/unit/filters.test.ts` 覆蓋：

```ts
expect(parseProductFilters({ category: '上衣', series: 'Mori flora 漫花系列' }))
  .toMatchObject({ category: '上衣', series: 'Mori flora 漫花系列' })
expect(parseProductFilters({ series: 'Mori flora 漫花系列' }).series).toBeUndefined()
expect(applyCatalogFilters(products, {
  category: '上衣',
  series: 'Mori flora 漫花系列',
  size: '100',
  inStock: true,
})).toEqual([floraTee])
expect(applyCatalogFilters(products, { category: '褲裝', series: 'Mori flora 漫花系列' })).toEqual([])
```

- [ ] **Step 2: 執行測試並確認 RED**

Run: `pnpm exec vitest run tests/unit/filters.test.ts`

Expected: FAIL，因 filters 與 product mapping 沒有 `series`。

- [ ] **Step 3: 實作正式與 fixture 查詢**

`productFields` 加入 `product_series_products(product_series(id, category_name, name, position))`；`mapProduct` 正規化成 `CatalogProduct.series`。`parseProductFilters` 先 trim category/series，只有兩者都有值才保留 series。`applyCatalogFilters` 以同時符合 categoryName 與 name 的關聯判斷，確保不存在或分類不符時回傳空清單而不噴錯。

- [ ] **Step 4: 實作列表系列切換列**

`ProductsPage` 並行取得 categories 與 `listProductSeries(filters.category)`。有 category 時在分類列下顯示：

- `全部{category}` → 保留其他 filters、移除 `series`。
- 每個系列 → 保留 category 與其他 filters、替換 `series`。
- 目前系列加 `aria-current="page"`。

`ProductFilters` form 只有當 category 與 series 都存在時輸出 hidden `series`；清除按鈕仍回 `/products`。空狀態補充「可改選其他系列或清除篩選條件」。

- [ ] **Step 5: 驗證**

Run: `pnpm exec vitest run tests/unit/filters.test.ts tests/unit/cart.test.ts`

Expected: PASS。

Run: `MORI_E2E_FIXTURES=1 pnpm exec playwright test tests/e2e/catalog.spec.ts --project=desktop`

Expected: PASS。

Run: `pnpm exec eslint src/features/catalog/queries.ts src/features/catalog/product-filters.tsx 'src/app/(store)/products/page.tsx'`

Expected: PASS。

- [ ] **Step 6: 提交本任務**

```bash
git add src/features/catalog/queries.ts src/features/catalog/product-filters.tsx 'src/app/(store)/products/page.tsx' src/testing/e2e-storefront-fixtures.ts src/app/globals.css tests/unit/filters.test.ts tests/unit/cart.test.ts tests/e2e/catalog.spec.ts
git commit -m "feat: filter catalog by product series"
```

---

## Task 5: 完成桌機雙欄與手機巢狀系列導覽

**Files:**
- Create: `src/components/category-series-menu.tsx`
- Modify: `src/components/site-header.tsx`
- Modify: `src/app/(store)/layout.tsx`
- Modify: `src/app/globals.css`
- Create: `tests/unit/category-series-menu.test.tsx`
- Modify: `tests/unit/storefront-header-contract.test.ts`
- Modify: `tests/unit/mobile-menu.test.tsx`

- [ ] **Step 1: 寫導覽元件失敗測試**

桌機測試驗證：預設選第一分類；點左欄「褲裝」只更新右欄，不導航；右欄第一項為「全部褲裝」；系列按 `position` 排序；連結 query 正確。

手機測試驗證：每個分類用 `<details>`；展開後第一項是全部分類，接著才是系列；點任何 link 仍由既有 `MobileMenu` click delegation 關閉 dialog。

- [ ] **Step 2: 執行測試並確認 RED**

Run: `pnpm exec vitest run tests/unit/category-series-menu.test.tsx tests/unit/mobile-menu.test.tsx tests/unit/storefront-header-contract.test.ts`

Expected: FAIL，因新元件及 series prop 尚不存在。

- [ ] **Step 3: 實作共用導覽元件**

元件 props：

```ts
type CategorySeriesMenuProps = {
  categories: readonly string[]
  series: readonly ProductSeries[]
  mode: 'desktop' | 'mobile'
}
```

桌機使用按鈕控制 React state，左欄 `aria-pressed` 表示目前分類；右欄為真正 `<Link>`。不要以 hover 作為唯一操作方式。手機使用原生 `<details>/<summary>`，系列依所屬分類分組；分類沒有系列時仍顯示「全部{category}」。

- [ ] **Step 4: 串接 header 與 layout**

`StoreLayout` 的 `Promise.all` 加 `listProductSeries()`，傳入 `SiteHeader series={series}`。桌機現有 `AutoCloseDetails` 保留外部點擊與 Escape 關閉；手機保留左側漢堡、搜尋、會員、Logo、購物車既有排列，只替換分類內容。

- [ ] **Step 5: 實作雙欄及手機樣式**

桌機面板至少可容納兩個 13rem 欄位，分類選取用現有淡藍底；右欄細分隔線。手機單欄、第二層縮排、summary 觸控高度至少 44px。所有新增 selector 使用 `.category-series-*`，避免改壞既有 header 對齊。

- [ ] **Step 6: 驗證**

Run: `pnpm exec vitest run tests/unit/category-series-menu.test.tsx tests/unit/mobile-menu.test.tsx tests/unit/storefront-header-contract.test.ts tests/unit/mobile-header-search.test.tsx`

Expected: PASS。

Run: `pnpm exec tsc --noEmit`

Expected: PASS。

- [ ] **Step 7: 提交本任務**

```bash
git add src/components/category-series-menu.tsx src/components/site-header.tsx 'src/app/(store)/layout.tsx' src/app/globals.css tests/unit/category-series-menu.test.tsx tests/unit/storefront-header-contract.test.ts tests/unit/mobile-menu.test.tsx
git commit -m "feat: add category series navigation"
```

---

## Task 6: 完整瀏覽器流程、無障礙與響應式驗收

**Files:**
- Create: `tests/e2e/category-series-navigation.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`
- Modify: `tests/e2e/mobile.spec.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: 寫完整 E2E 失敗測試**

fixture mode 流程：管理員登入 → 分類頁新增「Mori weekend 週末系列」→ 上移 → 新增或編輯上衣並勾選兩系列 → 返回商城 → 桌機雙欄選該系列 → 商品列表只顯示關聯商品 → 再搭配尺寸／庫存篩選 → 清除條件。

另寫手機 375×812：漢堡從左開啟 → 商品分類 → 展開上衣 → 點系列 → dialog 關閉且 URL 包含 category/series；整頁 `document.documentElement.scrollWidth === window.innerWidth`。

- [ ] **Step 2: 執行 E2E 並確認 RED**

Run: `MORI_E2E_FIXTURES=1 pnpm exec playwright test tests/e2e/category-series-navigation.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/mobile.spec.ts --project=desktop --project=mobile`

Expected: 新系列流程 FAIL；既有案例應維持 PASS。

- [ ] **Step 3: 只修正驗收揭露的本功能問題**

若焦點順序、長系列名稱換行、面板寬度或手機溢出失敗，只調整 `.category-series-*`、`.catalog-series-*`、`.admin-series-*`。不要趁機重構其他 header、footer 或 admin layout。

- [ ] **Step 4: 執行完整驗證**

Run: `pnpm exec vitest run`

Expected: 全部 PASS。

Run: `MORI_E2E_FIXTURES=1 pnpm exec playwright test --project=desktop --project=mobile`

Expected: 全部 PASS。

Run: `pnpm exec eslint .`

Expected: PASS；若有既存錯誤，必須列出與本次變更無關的檔案，並確保所有本次檔案個別 lint 通過。

Run: `pnpm exec tsc --noEmit && pnpm run build`

Expected: 型別檢查及 production build PASS。

- [ ] **Step 5: 提交本任務**

```bash
git add tests/e2e/category-series-navigation.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/mobile.spec.ts src/app/globals.css
git commit -m "test: cover category series journeys"
```

---

## Task 7: 套用正式資料庫並驗證上線資料

**Files:**
- Verify only: `supabase/migrations/202607310001_product_series.sql`
- Verify only: `supabase/migrations/202607310002_product_series_assignments.sql`
- Verify only: `.env.local`

- [ ] **Step 1: 確認連結專案與 migration 順序**

Run: `pnpm dlx supabase@latest migration list`

Expected: 兩個 `20260731...` migration 尚未出現在 remote，較早 migration local/remote 一致。若未連結 Supabase 或缺少登入，不猜 project ref，停止並回報需要使用者登入。

- [ ] **Step 2: 先做資料庫 dry run**

Run: `pnpm dlx supabase@latest db push --dry-run`

Expected: 只會套用本功能兩個 migration，沒有 drop 既有商品、訂單、庫存或會員表。

- [ ] **Step 3: 套用 migration**

Run: `pnpm dlx supabase@latest db push`

Expected: 兩個 migration 成功。

- [ ] **Step 4: 驗證 schema 與安全建議**

Run: `pnpm dlx supabase@latest db lint --linked --level warning`

Expected: 本次 tables/functions 無 warning。再於 Supabase SQL editor 或唯讀 client 驗證：

```sql
select category_name, name, position from public.product_series order by category_name, position;
select count(*) from public.product_series_products;
```

Expected: 初始正式資料皆為 0，既有商品仍正常顯示且不強迫指定系列。

- [ ] **Step 5: 上線前最終差異檢查**

Run: `git status --short && git diff --check && git log --oneline -7`

Expected: 只有使用者原本尚未提交的變更可留在工作區；本功能提交完整且無 whitespace error。若現行站台由 Git push 自動部署，先向使用者確認要推送的 branch，再執行 push；不可把無關工作區變更一起提交或部署。

---

## Final Acceptance Checklist

- [ ] 老闆可依分類新增、排序、刪除未使用系列。
- [ ] 使用中的系列與仍有系列的分類都不能誤刪。
- [ ] 商品可勾選同分類多個系列，換分類會清除不相容選項。
- [ ] 新增、編輯、草稿、fixture 與正式 Supabase 都保存相同系列資料。
- [ ] 桌機為雙欄分類／系列選單，鍵盤可操作。
- [ ] 手機為左側漢堡內的兩層收合，選擇後自動關閉。
- [ ] 商品列表支援分類＋系列＋既有條件，URL 可分享與重新整理。
- [ ] 不存在、單獨或分類不符的 series 參數不造成 runtime error。
- [ ] 375px 手機及桌機無水平溢出，長系列名稱不破版。
- [ ] Vitest、Playwright、ESLint、TypeScript、production build 與 Supabase lint 皆有實際結果。
- [ ] 沒有未完成佔位內容、假資料、未使用 import 或與需求無關的改動。
