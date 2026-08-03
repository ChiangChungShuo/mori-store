# 商品多件優惠價 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓老闆在單一商品設定多個件數組合價，顧客混搭同商品的顏色與尺寸時自動套用最低總價，並讓購物車、優惠碼、結帳及訂單金額保持一致。

**Architecture:** 以 `product_quantity_prices` 儲存商品專屬階梯，並由純函式 `calculateQuantityPricing()` 負責跨規格分組與最低價動態規劃。商品頁與購物車使用伺服器刷新後的階梯資料即時預覽；建立付款交易時再以資料庫最新售價、庫存與階梯重新計算，付款交易及訂單保存原價、多件折抵、優惠碼折抵與套用組合快照。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Zod 4、Supabase/PostgreSQL、Vitest、Testing Library、Playwright、Vercel

## Global Constraints

- 多件優惠只計算同一商品，不跨商品、分類或系列。
- 同一商品的不同顏色、尺寸合併件數，但庫存仍按實際規格扣除。
- 每個商品可設定多個階梯；件數從 2 開始，同一件數不可重複。
- 1 件使用該規格原價；無法整除時比較重複階梯與剩餘單件的所有合法組合。
- 計算器必須選擇最低總價，且不得套用會讓顧客多付的階梯。
- 多件優惠自動套用，不要求輸入優惠碼。
- 多件優惠後仍可疊加優惠碼；優惠碼門檻、折抵上限與免運門檻均以多件優惠後、優惠碼前的商品金額計算。
- 商品原始小計、多件優惠、優惠碼、運費與應付合計必須分開顯示與保存。
- 商品或優惠在結帳送出前變更時，以伺服器最新資料重算，不接受瀏覽器提供的價格。
- 修改或刪除商品階梯不得改變既有付款交易與訂單快照。
- 不新增組合 SKU、不建立第二套庫存、不新增第三方套件。
- 既有行銷頁不再允許新增全站 `quantity_discount`，但歷史資料不得刪除。
- 保留現有未提交的 `next-env.d.ts` 與 `tsconfig.tsbuildinfo`，所有提交不得包含這兩個檔案。

---

## File Map

### New files

- `src/features/cart/quantity-pricing.ts`：唯一的多件最低價計算器與共用型別。
- `src/features/admin/quantity-price-editor.tsx`：商品後台的多件優惠階梯編輯器。
- `tests/unit/quantity-pricing.test.ts`：最低價、混搭與不利階梯測試。
- `tests/integration/product-quantity-pricing-migration.test.ts`：資料表、RLS、RPC 與訂單快照 migration 合約測試。
- `supabase/migrations/202607310003_product_quantity_pricing.sql`：階梯資料、折扣快照欄位、商品更新 RPC 與訂單同步函式。

### Modified files

- `src/lib/validation/product.ts`：`quantityPrices` schema、重複件數錯誤與型別。
- `src/features/admin/product-form.tsx`：在規格與庫存下方掛載階梯編輯器並顯示錯誤。
- `src/app/admin/products/new/page.tsx`：新商品預設 `quantityPrices: []`。
- `src/features/admin/product-actions.ts`：E2E 與 Supabase 商品讀寫階梯。
- `src/testing/e2e-store.ts`：本機後台 fixture 保存商品階梯。
- `src/testing/e2e-storefront-fixtures.ts`：前台 fixture 商品與購物車快照帶入階梯。
- `src/types/database.ts`：新增資料表與付款／訂單欄位型別。
- `src/features/catalog/queries.ts`：商品、商品頁及購物車刷新查詢讀取階梯。
- `src/features/catalog/variant-picker.tsx`：加入購物車時寫入 `productId` 與階梯快照。
- `src/features/cart/types.ts`：購物車項目增加商品識別與階梯，並相容舊 localStorage。
- `src/features/cart/totals.ts`：整合多件折抵與折後免運計算。
- `src/app/api/cart/refresh/route.ts`：回傳完整多件優惠摘要。
- `src/features/cart/cart-page-client.tsx`：顯示套用組合與分開的折扣列。
- `src/features/checkout/checkout-form.tsx`：使用折後商品金額驗證優惠碼並顯示多件折抵。
- `src/features/checkout/service.ts`：伺服器權威重算及付款快照。
- `src/testing/e2e-checkout-repository.ts`：本機結帳 fixture 支援新欄位。
- `src/app/admin/marketing/page.tsx`：移除新增全站滿件折的選項。
- `src/app/globals.css`：後台階梯編輯器、商品頁優惠卡與折扣明細樣式。
- `tests/unit/cart.test.ts`：購物車折扣、折後免運與舊資料相容測試。
- `tests/integration/admin-products.test.ts`：商品階梯新增、修改、刪除及驗證測試。
- `tests/integration/checkout-review.test.tsx`：結帳頁多件優惠與優惠碼顯示測試。
- `tests/integration/payment.test.ts`：伺服器重算與付款快照測試。
- `tests/e2e/storefront-interactions.spec.ts`：完整前台多件優惠與優惠碼流程。
- `tests/e2e/local-admin-product.spec.ts`：老闆建立及編輯多個階梯流程。

---

### Task 1: 建立最低價計算器

**Files:**
- Create: `src/features/cart/quantity-pricing.ts`
- Create: `tests/unit/quantity-pricing.test.ts`

**Interfaces:**
- Consumes: 商品 ID、規格 ID、單價、數量與同商品的階梯陣列。
- Produces:

```ts
export type QuantityPriceTier = {
  quantity: number
  bundlePrice: number
}

export type QuantityPricedItem = {
  productId: string
  variantId: string
  unitPrice: number
  quantity: number
  quantityPrices: readonly QuantityPriceTier[]
}

export type QuantityPriceApplication = {
  quantity: number
  bundlePrice: number
  count: number
}

export type ProductQuantityPriceBreakdown = {
  productId: string
  regularSubtotal: number
  discountedSubtotal: number
  discount: number
  applications: QuantityPriceApplication[]
  singleCount: number
}

export type QuantityPricingResult = {
  regularSubtotal: number
  discountedSubtotal: number
  quantityDiscount: number
  products: ProductQuantityPriceBreakdown[]
}

export function calculateQuantityPricing(
  items: readonly QuantityPricedItem[],
): QuantityPricingResult
```

- [ ] **Step 1: Write failing calculator tests**

Add tests with exact expectations:

```ts
import { describe, expect, it } from 'vitest'
import { calculateQuantityPricing } from '@/features/cart/quantity-pricing'

const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const tiers = [
  { quantity: 2, bundlePrice: 1000 },
  { quantity: 3, bundlePrice: 1350 },
]

function item(quantity: number, unitPrice = 590, variantId = 'v1') {
  return { productId, variantId, unitPrice, quantity, quantityPrices: tiers }
}

describe('calculateQuantityPricing', () => {
  it('applies one exact tier', () => {
    expect(calculateQuantityPricing([item(2)])).toMatchObject({
      regularSubtotal: 1180,
      discountedSubtotal: 1000,
      quantityDiscount: 180,
      products: [{ applications: [{ quantity: 2, bundlePrice: 1000, count: 1 }], singleCount: 0 }],
    })
  })

  it('chooses the cheapest repeated combination for four and six items', () => {
    expect(calculateQuantityPricing([item(4)]).discountedSubtotal).toBe(2000)
    expect(calculateQuantityPricing([item(6)]).discountedSubtotal).toBe(2700)
  })

  it('combines colors and sizes of the same product and bundles expensive units first', () => {
    const result = calculateQuantityPricing([
      item(1, 700, 'green-100'),
      item(2, 590, 'blue-110'),
    ])
    expect(result).toMatchObject({
      regularSubtotal: 1880,
      discountedSubtotal: 1350,
      quantityDiscount: 530,
    })
  })

  it('prices different products independently', () => {
    const result = calculateQuantityPricing([
      item(2),
      { ...item(2), productId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', quantityPrices: [{ quantity: 2, bundlePrice: 900 }] },
    ])
    expect(result.discountedSubtotal).toBe(1900)
  })

  it('keeps regular pricing when a tier costs more', () => {
    const result = calculateQuantityPricing([
      { ...item(2), quantityPrices: [{ quantity: 2, bundlePrice: 1300 }] },
    ])
    expect(result).toMatchObject({
      regularSubtotal: 1180,
      discountedSubtotal: 1180,
      quantityDiscount: 0,
    })
  })
})
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run: `pnpm exec vitest run tests/unit/quantity-pricing.test.ts`

Expected: FAIL because `@/features/cart/quantity-pricing` does not exist.

- [ ] **Step 3: Implement the minimal dynamic-programming calculator**

Implement these rules in `quantity-pricing.ts`:

```ts
type PriceState = {
  cost: number
  applications: QuantityPriceApplication[]
  singleCount: number
}

function priceProduct(unitPrices: number[], tiersInput: readonly QuantityPriceTier[]) {
  const unitPricesDescending = [...unitPrices].sort((a, b) => b - a)
  const tiers = [...tiersInput]
    .filter((tier) => Number.isInteger(tier.quantity)
      && tier.quantity >= 2
      && Number.isInteger(tier.bundlePrice)
      && tier.bundlePrice >= 0)
    .sort((a, b) => b.quantity - a.quantity || a.bundlePrice - b.bundlePrice)
  const states: Array<PriceState | undefined> = Array(unitPricesDescending.length + 1)
  states[0] = { cost: 0, applications: [], singleCount: 0 }

  for (let consumed = 0; consumed < unitPricesDescending.length; consumed += 1) {
    const state = states[consumed]
    if (!state) continue

    const regular: PriceState = {
      cost: state.cost + unitPricesDescending[consumed],
      applications: state.applications,
      singleCount: state.singleCount + 1,
    }
    if (!states[consumed + 1] || regular.cost < states[consumed + 1]!.cost) {
      states[consumed + 1] = regular
    }

    for (const tier of tiers) {
      const next = consumed + tier.quantity
      if (next > unitPricesDescending.length) continue
      const existing = state.applications.find((entry) => (
        entry.quantity === tier.quantity && entry.bundlePrice === tier.bundlePrice
      ))
      const applications = existing
        ? state.applications.map((entry) => entry === existing ? { ...entry, count: entry.count + 1 } : entry)
        : [...state.applications, { ...tier, count: 1 }]
      const candidate = { cost: state.cost + tier.bundlePrice, applications, singleCount: state.singleCount }
      if (!states[next] || candidate.cost < states[next]!.cost) states[next] = candidate
    }
  }

  return states[unitPricesDescending.length]!
}
```

Group items by `productId`, expand each `unitPrice` exactly `quantity` times, take the first valid tier list for that product, call `priceProduct()`, then sum the product breakdowns. Sort returned `applications` by `quantity` descending so UI text is deterministic.

- [ ] **Step 4: Run calculator tests**

Run: `pnpm exec vitest run tests/unit/quantity-pricing.test.ts`

Expected: 5 tests PASS.

- [ ] **Step 5: Commit the calculator**

```bash
git add src/features/cart/quantity-pricing.ts tests/unit/quantity-pricing.test.ts
git commit -m "feat: add product quantity price calculator"
```

---

### Task 2: 驗證與編輯商品階梯

**Files:**
- Create: `src/features/admin/quantity-price-editor.tsx`
- Modify: `src/lib/validation/product.ts`
- Modify: `src/features/admin/product-form.tsx`
- Modify: `src/app/admin/products/new/page.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/integration/admin-products.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `QuantityPriceTier`。
- Produces: `ProductInput['quantityPrices']`，格式固定為 `{ quantity: number; bundlePrice: number }[]`。

- [ ] **Step 1: Write failing validation and editor tests**

Add schema cases:

```ts
const validProduct = {
  name: '慢日上衣',
  slug: 'slow-tee',
  category: '上衣',
  seriesIds: [],
  ageBands: ['3-6'],
  description: '',
  material: '',
  careInstructions: '',
  sizeGuide: '',
  isNew: false,
  variants: [{ sku: 'TEE-100', color: '藍', size: '100', price: 590, stock: 5 }],
}

it('accepts multiple quantity price tiers and rejects duplicate quantities', () => {
  expect(productSchema.safeParse({
    ...validProduct,
    quantityPrices: [{ quantity: 2, bundlePrice: 1000 }, { quantity: 3, bundlePrice: 1350 }],
  }).success).toBe(true)

  const duplicate = productSchema.safeParse({
    ...validProduct,
    quantityPrices: [{ quantity: 2, bundlePrice: 1000 }, { quantity: 2, bundlePrice: 900 }],
  })
  expect(duplicate.success).toBe(false)
  if (!duplicate.success) expect(duplicate.error.issues[0]?.path).toEqual(['quantityPrices', 1, 'quantity'])
})
```

Render `ProductForm`, click `新增優惠階梯` twice, type `2 / 1000` and `3 / 1350`, submit, and expect `onSave` to receive the two tiers sorted by quantity. Add a second test that repeats quantity `2` and expects the inline message `同一件數只能設定一次`.

- [ ] **Step 2: Run the focused admin test and confirm the red state**

Run: `pnpm exec vitest run tests/integration/admin-products.test.ts`

Expected: FAIL because `quantityPrices` and the editor controls are absent.

- [ ] **Step 3: Extend the product schema**

Add:

```ts
export const quantityPriceSchema = z.object({
  quantity: z.number().int('件數必須是整數').min(2, '優惠件數至少為 2'),
  bundlePrice: z.number().int('組合價必須是整數').nonnegative('組合價不可小於 0'),
}).strict()
```

Add `quantityPrices: z.array(quantityPriceSchema).max(20, '多件優惠最多 20 組').default([])` to `productSchema`. At the start of `superRefine`, scan `product.quantityPrices` and add:

```ts
const quantities = new Set<number>()
product.quantityPrices.forEach((tier, index) => {
  if (quantities.has(tier.quantity)) {
    context.addIssue({
      code: 'custom',
      message: '同一件數只能設定一次',
      path: ['quantityPrices', index, 'quantity'],
    })
  }
  quantities.add(tier.quantity)
})
```

- [ ] **Step 4: Build the focused editor and mount it in the form**

Use this public component contract:

```tsx
type QuantityPriceEditorProps = {
  value: ProductInput['quantityPrices']
  onChange: (value: ProductInput['quantityPrices']) => void
  errors?: ProductQuantityPriceErrors
}

export function QuantityPriceEditor({ value, onChange, errors }: QuantityPriceEditorProps) {
  function update(index: number, field: 'quantity' | 'bundlePrice', raw: string) {
    const number = raw === '' ? Number.NaN : Number(raw)
    onChange(value.map((tier, tierIndex) => tierIndex === index
      ? { ...tier, [field]: number }
      : tier))
  }

  return (
    <section className="quantity-price-editor" aria-labelledby="quantity-price-heading">
      <header>
        <div><h3 id="quantity-price-heading">多件優惠</h3><p>同一商品不同顏色、尺寸可混搭，系統會自動選最省組合。</p></div>
        <button type="button" onClick={() => onChange([...value, {
          quantity: Math.max(1, ...value.map((tier) => tier.quantity)) + 1,
          bundlePrice: 0,
        }])}>
          ＋ 新增優惠階梯
        </button>
      </header>
      {value.length === 0 ? <p className="admin-empty-note">目前未設定，多件購買仍依單件售價計算。</p> : value.map((tier, index) => (
        <div className="quantity-price-row" key={index}>
          <label>件數<input min={2} type="number" value={Number.isNaN(tier.quantity) ? '' : tier.quantity} onChange={(event) => update(index, 'quantity', event.target.value)} /></label>
          <label>組合價<input min={0} type="number" value={Number.isNaN(tier.bundlePrice) ? '' : tier.bundlePrice} onChange={(event) => update(index, 'bundlePrice', event.target.value)} /></label>
          <p>{Number.isFinite(tier.quantity) && Number.isFinite(tier.bundlePrice) ? `任選 ${tier.quantity} 件 NT$${tier.bundlePrice.toLocaleString('zh-TW')}` : '請填寫件數與組合價'}</p>
          <button type="button" onClick={() => onChange(value.filter((_, tierIndex) => tierIndex !== index))}>刪除</button>
          {errors?.[index]?.quantity?.[0] ? <small role="alert">{errors[index].quantity![0]}</small> : null}
          {errors?.[index]?.bundlePrice?.[0] ? <small role="alert">{errors[index].bundlePrice![0]}</small> : null}
        </div>
      ))}
    </section>
  )
}
```

Mount it immediately below `VariantGrid`. Its `onChange` clears the previous result and updates `product.quantityPrices`; before invoking `onSave`, sort the parsed tiers by quantity ascending. Add `quantityPrices: '多件優惠'` to `FIELD_LABELS`.

Define and return nested errors explicitly:

```ts
type QuantityPriceField = 'quantity' | 'bundlePrice'
export type ProductQuantityPriceErrors =
  Array<Partial<Record<QuantityPriceField, string[]>>>
```

In `getProductValidationErrors()`, route Zod issues whose first path segment is `quantityPrices` into `quantityPriceErrors[rowIndex][field]`. Add `quantityPriceErrors?: ProductQuantityPriceErrors` to `ProductActionResult` and pass it to the editor after a submit attempt.

- [ ] **Step 5: Set defaults and style the controls**

Add `quantityPrices: []` to `newProduct`. Add CSS using the existing pale-blue admin tokens, a two-column desktop row, one-column mobile layout below `720px`, visible focus outlines, and at least `44px` button height.

- [ ] **Step 6: Run admin tests**

Run: `pnpm exec vitest run tests/integration/admin-products.test.ts`

Expected: all admin product tests PASS, including two new quantity-tier cases.

- [ ] **Step 7: Commit the validated editor**

```bash
git add src/lib/validation/product.ts src/features/admin/quantity-price-editor.tsx src/features/admin/product-form.tsx src/app/admin/products/new/page.tsx src/app/globals.css tests/integration/admin-products.test.ts
git commit -m "feat: add product quantity pricing editor"
```

---

### Task 3: Persist product tiers atomically

**Files:**
- Create: `supabase/migrations/202607310003_product_quantity_pricing.sql`
- Create: `tests/integration/product-quantity-pricing-migration.test.ts`
- Modify: `src/types/database.ts`
- Modify: `src/features/admin/product-actions.ts`
- Modify: `src/testing/e2e-store.ts`
- Modify: `src/testing/e2e-storefront-fixtures.ts`

**Interfaces:**
- Consumes: `ProductInput.quantityPrices`.
- Produces: `public.product_quantity_prices` and admin reads/writes that preserve a sorted tier list.

- [ ] **Step 1: Write the failing migration contract test**

The test must read the generated SQL and assert:

```ts
expect(sql).toMatch(/create table public\.product_quantity_prices/i)
expect(sql).toMatch(/unique\s*\(product_id,\s*quantity\)/i)
expect(sql).toMatch(/check\s*\(quantity >= 2\)/i)
expect(sql).toMatch(/check\s*\(bundle_price >= 0\)/i)
expect(sql).toMatch(/alter table public\.product_quantity_prices enable row level security/i)
expect(sql).toMatch(/create or replace function public\.admin_update_product/i)
expect(sql).toMatch(/jsonb_array_elements\(coalesce\(p_product -> 'quantityPrices'/i)
expect(sql).toMatch(/quantity_discount integer not null default 0/i)
expect(sql).toMatch(/quantity_pricing jsonb not null default '\[\]'::jsonb/i)
expect(sql).toMatch(/sync_payment_checkout_details_to_order/i)
```

- [ ] **Step 2: Run the migration test and confirm the red state**

Run: `pnpm exec vitest run tests/integration/product-quantity-pricing-migration.test.ts`

Expected: FAIL because the generated migration is empty.

- [ ] **Step 3: Create the table, RLS and snapshot columns**

Write:

```sql
create table public.product_quantity_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity >= 2),
  bundle_price integer not null check (bundle_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, quantity)
);

create trigger product_quantity_prices_set_updated_at
before update on public.product_quantity_prices
for each row execute function public.set_updated_at();

alter table public.product_quantity_prices enable row level security;

create policy product_quantity_prices_published_read
on public.product_quantity_prices for select
using (
  public.is_admin()
  or exists (
    select 1 from public.products
    where products.id = product_quantity_prices.product_id
      and products.is_published
  )
);

alter table public.payment_attempts
  add column quantity_discount integer not null default 0 check (quantity_discount >= 0),
  add column quantity_pricing jsonb not null default '[]'::jsonb
    check (jsonb_typeof(quantity_pricing) = 'array');

alter table public.orders
  add column quantity_discount integer not null default 0 check (quantity_discount >= 0),
  add column discount integer not null default 0 check (discount >= 0),
  add column coupon_code text,
  add column quantity_pricing jsonb not null default '[]'::jsonb
    check (jsonb_typeof(quantity_pricing) = 'array');
```

- [ ] **Step 4: Extend the existing product update RPC without changing its signature**

Copy the latest `admin_update_product(uuid, jsonb, jsonb)` body from `20260730175802_product_series_assignments.sql` into the new migration. Immediately after replacing `product_series_products`, add:

```sql
delete from public.product_quantity_prices
where product_id = p_product_id;

insert into public.product_quantity_prices (product_id, quantity, bundle_price)
select
  p_product_id,
  (tier.value ->> 'quantity')::integer,
  (tier.value ->> 'bundlePrice')::integer
from jsonb_array_elements(
  coalesce(p_product -> 'quantityPrices', '[]'::jsonb)
) as tier(value);
```

Keep the existing function arguments, product/series/variant locking, variant ownership checks and grants unchanged. `admin_create_product(jsonb, jsonb)` already delegates to this function, so create and update remain one transaction.

- [ ] **Step 5: Extend the existing order-sync function**

Replace the existing function with:

```sql
create or replace function public.sync_payment_checkout_details_to_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_id is not null then
    update public.orders
    set customer_note = new.customer_note,
      payment_method = new.payment_method,
      quantity_discount = new.quantity_discount,
      discount = new.discount,
      coupon_code = new.coupon_code,
      quantity_pricing = new.quantity_pricing
    where id = new.order_id;
  end if;
  return new;
end;
$$;
```

The existing trigger remains attached to `payment_attempts.order_id`. This avoids duplicating the large payment-completion function while still copying the immutable attempt snapshot as soon as the order is linked.

- [ ] **Step 6: Update generated-style database types and repositories**

Add table row/insert/update/relationship types for `product_quantity_prices`; add `quantity_discount` and `quantity_pricing` to `payment_attempts`; add `quantity_discount`, `discount`, `coupon_code` and `quantity_pricing` to `orders`.

In `getAdminProduct()` include:

```ts
product_quantity_prices(quantity, bundle_price)
```

and map:

```ts
quantityPrices: [...data.product_quantity_prices]
  .sort((a, b) => a.quantity - b.quantity)
  .map((tier) => ({ quantity: tier.quantity, bundlePrice: tier.bundle_price })),
```

Store `quantityPrices` on E2E product records during create/update and return it in E2E admin reads. Existing fixtures default to `[]`.

- [ ] **Step 7: Run migration and admin tests**

Run:

```bash
pnpm exec vitest run tests/integration/product-quantity-pricing-migration.test.ts tests/integration/admin-products.test.ts tests/integration/product-series-migration.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 8: Commit persistence**

```bash
git add supabase/migrations/202607310003_product_quantity_pricing.sql tests/integration/product-quantity-pricing-migration.test.ts src/types/database.ts src/features/admin/product-actions.ts src/testing/e2e-store.ts src/testing/e2e-storefront-fixtures.ts
git commit -m "feat: persist product quantity prices"
```

---

### Task 4: Carry tiers through catalog and cart refresh

**Files:**
- Modify: `src/features/catalog/queries.ts`
- Modify: `src/features/catalog/variant-picker.tsx`
- Modify: `src/features/cart/types.ts`
- Modify: `src/features/cart/refresh.ts`
- Modify: `src/app/api/cart/refresh/route.ts`
- Test: `tests/unit/cart.test.ts`
- Test: `tests/unit/catalog-review.test.ts`

**Interfaces:**
- Consumes: Task 1 `QuantityPriceTier` and Task 3 database relation.
- Produces: every canonical `CartItem` has `productId` and `quantityPrices`; refresh returns server-current data.

- [ ] **Step 1: Write failing cart migration and refresh tests**

Update cart fixtures to include:

```ts
productId: '11111111-1111-4111-8111-111111111111',
quantityPrices: [{ quantity: 2, bundlePrice: 1000 }],
```

Add a legacy localStorage case lacking both keys and expect it to survive parsing as:

```ts
expect(parseStoredCartItems([legacyItem])[0]).toMatchObject({
  productId: legacyItem.variantId,
  quantityPrices: [],
})
```

Add a query contract assertion for `product_quantity_prices(quantity, bundle_price)` in both product and cart-variant selects.

- [ ] **Step 2: Run focused tests and confirm the red state**

Run: `pnpm exec vitest run tests/unit/cart.test.ts tests/unit/catalog-review.test.ts`

Expected: FAIL because the catalog and cart models do not expose tiers.

- [ ] **Step 3: Extend catalog mapping**

Add `quantityPrices: readonly QuantityPriceTier[]` to `CatalogProduct`. Extend `ProductRecord.products` and `CartVariantRecord.products` with:

```ts
product_quantity_prices: Array<{ quantity: number; bundle_price: number }>
```

Select the relation and map it with:

```ts
quantityPrices: [...record.product_quantity_prices]
  .sort((a, b) => a.quantity - b.quantity)
  .map((tier) => ({ quantity: tier.quantity, bundlePrice: tier.bundle_price })),
```

For cart snapshots also return `productId: variant.products.id`.

- [ ] **Step 4: Extend cart types without discarding old carts**

Change `CartItem` to include:

```ts
productId: string
quantityPrices: readonly QuantityPriceTier[]
```

When parsing old stored items, accept missing `productId` and `quantityPrices`; normalize to `productId: canonical variantId` and `quantityPrices: []`. Continue validating canonical refreshed items strictly. The `/api/cart/refresh` response replaces these legacy fallbacks with the current product ID and tiers.

- [ ] **Step 5: Add canonical metadata when adding a product**

In `VariantPicker` dispatch:

```ts
productId: product.id,
quantityPrices: product.quantityPrices,
```

Keep all existing image, color, size, stock and add-to-cart animation behavior unchanged.

- [ ] **Step 6: Verify the focused data-flow tests**

Run: `pnpm exec vitest run tests/unit/cart.test.ts tests/unit/catalog-review.test.ts`

Expected: all selected tests PASS.

- [ ] **Step 7: Commit catalog and cart payload changes**

```bash
git add src/features/catalog/queries.ts src/features/catalog/variant-picker.tsx src/features/cart/types.ts src/features/cart/refresh.ts src/app/api/cart/refresh/route.ts tests/unit/cart.test.ts tests/unit/catalog-review.test.ts
git commit -m "feat: refresh quantity prices with cart items"
```

---

### Task 5: Apply and display multi-buy pricing in cart and product page

**Files:**
- Modify: `src/features/cart/totals.ts`
- Modify: `src/features/cart/cart-page-client.tsx`
- Modify: `src/features/catalog/variant-picker.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/unit/cart.test.ts`

**Interfaces:**
- Consumes: `calculateQuantityPricing(items)`.
- Produces:

```ts
type CartTotals = {
  subtotal: number
  discountedSubtotal: number
  quantityDiscount: number
  shipping: number
  total: number
  productDiscounts: ProductQuantityPriceBreakdown[]
}
```

- [ ] **Step 1: Write failing totals and UI tests**

Add:

```ts
it('uses the quantity-discounted subtotal for free shipping', () => {
  const totals = calculateCart([{
    productId: tee.productId,
    variantId: tee.variantId,
    unitPrice: 800,
    quantity: 2,
    quantityPrices: [{ quantity: 2, bundlePrice: 1400 }],
  }], 60, 1500)

  expect(totals).toMatchObject({
    subtotal: 1600,
    discountedSubtotal: 1400,
    quantityDiscount: 200,
    shipping: 60,
    total: 1460,
  })
})
```

Render `CartPageClient` with two variants sharing a product ID and expect `多件優惠`, `−NT$180`, and `已套用：2 件優惠 × 1`. Assert the coupon action receives `1000`, not the original `1180`.

- [ ] **Step 2: Run cart tests and confirm the red state**

Run: `pnpm exec vitest run tests/unit/cart.test.ts`

Expected: FAIL because totals do not include discounted subtotal or breakdown.

- [ ] **Step 3: Integrate the calculator into totals**

Implement:

```ts
export function calculateCart(
  items: QuantityPricedItem[],
  shippingFee: number,
  freeShippingThreshold: number | null,
) {
  const pricing = calculateQuantityPricing(items)
  const hasFreeShipping = freeShippingThreshold !== null
    && pricing.discountedSubtotal >= freeShippingThreshold
  const shipping = pricing.discountedSubtotal === 0 || hasFreeShipping ? 0 : shippingFee

  return {
    subtotal: pricing.regularSubtotal,
    discountedSubtotal: pricing.discountedSubtotal,
    quantityDiscount: pricing.quantityDiscount,
    shipping,
    total: pricing.discountedSubtotal + shipping,
    productDiscounts: pricing.products,
  }
}
```

- [ ] **Step 4: Update cart calculations and copy**

Use `totals.discountedSubtotal` for:

- remaining free-shipping amount;
- free-shipping progress;
- coupon validation request;
- coupon-result staleness key.

Display summary rows in this order: `商品小計`, conditional `多件優惠`, `優惠碼`, `超商運費`, `應付合計`. For the first cart row of each discounted product, format its breakdown as:

```ts
const applied = breakdown.applications
  .map((entry) => `${entry.quantity} 件優惠 × ${entry.count}`)
const label = [...applied, ...(breakdown.singleCount ? [`單件 × ${breakdown.singleCount}`] : [])].join('＋')
```

Add a product-page card beside the variant selection only when `product.quantityPrices.length > 0`, listing `任選 N 件 NT$X`, `不同顏色、尺寸可混搭`, and `系統會自動套用最優惠組合`.

- [ ] **Step 5: Style and accessibility-check the new display**

Use existing pale-blue border/background variables. The applied label must remain text, not color-only; the summary remains a `dl`/label-value structure; the card has an `h2` or `h3`; no animation is added to price changes when `prefers-reduced-motion` is enabled.

- [ ] **Step 6: Run cart tests**

Run: `pnpm exec vitest run tests/unit/cart.test.ts`

Expected: all cart tests PASS. The full keyboard and screen-reader-name browser checks run with Playwright in Task 8.

- [ ] **Step 7: Commit cart and product-page presentation**

```bash
git add src/features/cart/totals.ts src/features/cart/cart-page-client.tsx src/features/catalog/variant-picker.tsx src/app/globals.css tests/unit/cart.test.ts
git commit -m "feat: show automatic quantity discounts"
```

---

### Task 6: Make checkout and payment snapshots authoritative

**Files:**
- Modify: `src/features/checkout/checkout-form.tsx`
- Modify: `src/features/checkout/service.ts`
- Modify: `src/lib/validation/checkout.ts`
- Modify: `src/features/checkout/types.ts`
- Modify: `src/app/(store)/checkout/page.tsx`
- Modify: `src/testing/e2e-checkout-repository.ts`
- Modify: `src/types/database.ts`
- Modify: `src/features/orders/queries.ts`
- Modify: `src/features/orders/order-card.tsx`
- Modify: `src/features/admin/order-actions.ts`
- Modify: `src/app/admin/orders/[orderNumber]/page.tsx`
- Modify: `src/app/admin/orders/review/[attemptId]/page.tsx`
- Modify: `src/lib/email/order-confirmation.ts`
- Test: `tests/integration/checkout-review.test.tsx`
- Test: `tests/integration/payment.test.ts`
- Test: `tests/integration/order-access.test.ts`
- Test: `tests/integration/admin-orders.test.ts`

**Interfaces:**
- Consumes: Task 5 `CartTotals`.
- Produces:

```ts
export type PaymentAttemptInsert = {
  // existing customer, store, amount and item fields remain
  quantityDiscount: number
  quantityPricing: ProductQuantityPriceBreakdown[]
}
```

`CheckoutVariant` additionally includes:

```ts
productId: string
quantityPrices: readonly QuantityPriceTier[]
```

- [ ] **Step 1: Write failing checkout and payment tests**

In `payment.test.ts`, give two same-product variants the same `productId` and tiers. Submit one of each and assert:

```ts
expect(repository.attempts[0]).toMatchObject({
  subtotal: 1180,
  quantityDiscount: 180,
  shippingFee: 60,
  total: 1060,
  quantityPricing: [{
    productId,
    regularSubtotal: 1180,
    discountedSubtotal: 1000,
    discount: 180,
  }],
})
```

Inject a coupon resolver and assert its `subtotal` argument is `1000`; return a `100` discount and expect final total `960`. In `checkout-review.test.tsx`, mock refresh summary with all new fields and expect separate `多件優惠 −NT$180` and `優惠碼 −NT$100` rows.

- [ ] **Step 2: Run checkout tests and confirm the red state**

Run:

```bash
pnpm exec vitest run tests/integration/payment.test.ts tests/integration/checkout-review.test.tsx
```

Expected: FAIL because checkout currently validates coupons against original subtotal and does not persist quantity pricing.

- [ ] **Step 3: Fetch current tiers with checkout variants**

Change the Supabase select to include:

```ts
products!inner(
  id, name, is_published, available_at,
  product_images(storage_path, position),
  product_quantity_prices(quantity, bundle_price)
)
```

Map:

```ts
productId: product.id,
quantityPrices: product.product_quantity_prices
  .sort((a, b) => a.quantity - b.quantity)
  .map((tier) => ({ quantity: tier.quantity, bundlePrice: tier.bundle_price })),
```

- [ ] **Step 4: Recalculate and persist the authoritative attempt**

Pass `productId`, `variantId`, `unitPrice`, `quantity` and `quantityPrices` into `calculateCart()`. Change coupon resolution to:

```ts
const coupon = customer.couponCode
  ? await resolveCoupon(customer.couponCode, totals.discountedSubtotal)
  : null
```

Insert:

```ts
subtotal: totals.subtotal,
quantityDiscount: totals.quantityDiscount,
quantityPricing: totals.productDiscounts,
shippingFee: totals.shipping,
total: Math.max(0, totals.total - (coupon?.discount ?? 0)),
```

Map `quantity_discount` and `quantity_pricing` in the real Supabase repository and E2E repository. Keep `discount` exclusively for the coupon discount.

- [ ] **Step 5: Reject a checkout page that has become stale**

Add required non-negative integer fields to `checkoutSchema`:

```ts
expectedSubtotal: z.coerce.number().int().nonnegative(),
expectedDiscountedSubtotal: z.coerce.number().int().nonnegative(),
expectedQuantityDiscount: z.coerce.number().int().nonnegative(),
expectedShipping: z.coerce.number().int().nonnegative(),
expectedCouponDiscount: z.coerce.number().int().nonnegative(),
```

After the server recalculates cart and coupon values, compare:

```ts
if (
  customer.expectedSubtotal !== totals.subtotal
  || customer.expectedDiscountedSubtotal !== totals.discountedSubtotal
  || customer.expectedQuantityDiscount !== totals.quantityDiscount
  || customer.expectedShipping !== totals.shipping
) {
  throw new CheckoutAttemptError('catalog_changed')
}
if (customer.expectedCouponDiscount !== (coupon?.discount ?? 0)) {
  throw new CheckoutAttemptError('coupon_invalid')
}
```

In `CheckoutForm`, submit the server-refresh values:

```tsx
<input type="hidden" name="expectedSubtotal" value={summary?.subtotal ?? ''} />
<input type="hidden" name="expectedDiscountedSubtotal" value={summary?.discountedSubtotal ?? ''} />
<input type="hidden" name="expectedQuantityDiscount" value={summary?.quantityDiscount ?? ''} />
<input type="hidden" name="expectedShipping" value={summary?.shipping ?? ''} />
<input type="hidden" name="expectedCouponDiscount" value={appliedCoupon?.discount ?? 0} />
```

Read these five form fields in `src/app/(store)/checkout/page.tsx` and pass them to `createPaymentAttempt()`. Update checkout fixtures with expected values. Add a payment test where the browser expects `1000` but the current tier now produces `1100`; expect `CheckoutAttemptError('catalog_changed')` and no inserted payment attempt.

- [ ] **Step 6: Update checkout review**

Parse the refresh summary only when these are non-negative integers:

```ts
subtotal
discountedSubtotal
quantityDiscount
shipping
total
```

Key coupon state and coupon requests by `discountedSubtotal`. Display original subtotal, conditional multi-buy discount, shipping, conditional coupon discount, and the final payable total.

- [ ] **Step 7: Preserve completed-attempt pricing snapshots**

The checkout service already fetches current tiers when creating the payment attempt. Add a focused test that first creates an attempt with `{ 2: 1000 }`, changes the repository tier to `{ 2: 1100 }`, creates a second attempt, and expects the first snapshot to remain `1000` while the second is `1100`. This proves new checkouts use current rules and completed orders retain their attempt snapshot.

- [ ] **Step 8: Expose the saved breakdown in customer, owner and email views**

Extend `OrderDetails`, `OrderRow`, `orderSelect`, the E2E order repository and admin order projections with:

```ts
quantityDiscount: number
discount: number
couponCode: string | null
quantityPricing: ProductQuantityPriceBreakdown[]
```

Map database snake_case fields exactly:

```ts
quantityDiscount: order.quantity_discount,
discount: order.discount,
couponCode: order.coupon_code,
quantityPricing: order.quantity_pricing as unknown as ProductQuantityPriceBreakdown[],
```

In the member/guest `OrderCard`, admin order detail, payment-review detail and order-confirmation email, display conditional rows between 商品小計 and 運費:

```tsx
{order.quantityDiscount > 0
  ? <div><dt>多件優惠</dt><dd>−{formatTwd(order.quantityDiscount)}</dd></div>
  : null}
{order.discount > 0
  ? <div><dt>{order.couponCode ? `優惠碼 ${order.couponCode}` : '優惠折抵'}</dt><dd>−{formatTwd(order.discount)}</dd></div>
  : null}
```

Pass `quantityDiscount`, `discount` and `couponCode` from `submitOrder()` into `sendOrderConfirmationEmail()`. Add assertions to `order-access.test.ts` and `admin-orders.test.ts` proving the two discounts render as separate rows.

For the email HTML table use `<tr><td>多件優惠</td><td>−NT$…</td></tr>` and a separate coupon row; do not insert the JSX `<div>` fragment into the email template.

- [ ] **Step 9: Run checkout and order tests**

Run:

```bash
pnpm exec vitest run tests/integration/payment.test.ts tests/integration/checkout-review.test.tsx tests/integration/fixture-orders.test.ts tests/integration/order-access.test.ts tests/integration/admin-orders.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 10: Commit authoritative checkout**

```bash
git add src/features/checkout/checkout-form.tsx src/features/checkout/service.ts src/lib/validation/checkout.ts src/features/checkout/types.ts 'src/app/(store)/checkout/page.tsx' src/testing/e2e-checkout-repository.ts src/types/database.ts src/features/orders/queries.ts src/features/orders/order-card.tsx src/features/admin/order-actions.ts 'src/app/admin/orders/[orderNumber]/page.tsx' 'src/app/admin/orders/review/[attemptId]/page.tsx' src/lib/email/order-confirmation.ts tests/integration/checkout-review.test.tsx tests/integration/payment.test.ts tests/integration/order-access.test.ts tests/integration/admin-orders.test.ts
git commit -m "feat: persist quantity discount checkout snapshots"
```

---

### Task 7: Remove the misleading global option and verify the owner workflow

**Files:**
- Modify: `src/app/admin/marketing/page.tsx`
- Modify: `tests/e2e/local-admin-product.spec.ts`
- Modify: `tests/e2e/storefront-interactions.spec.ts`

**Interfaces:**
- Consumes: completed admin, catalog, cart and checkout feature.
- Produces: browser-level acceptance coverage for the confirmed owner and shopper workflows.

- [ ] **Step 1: Write failing browser acceptance cases**

Admin case:

1. Open a new product.
2. Add `2 件 / NT$1,000` and `3 件 / NT$1,350`.
3. Save.
4. Reopen edit and assert both rows remain.
5. Delete the 2-item row, save, reopen and assert only the 3-item row remains.

Storefront case:

1. Open a fixture product with variants priced NT$590 and tiers `2 / 1000`, `3 / 1350`.
2. Add two different variants.
3. Open cart and assert original subtotal NT$1,180, multi-buy discount −NT$180, discounted merchandise NT$1,000.
4. Apply `HELLOMORI`; assert the coupon resolver uses NT$1,000 and both discounts remain visible.
5. Continue to checkout and assert the same amounts.

- [ ] **Step 2: Remove only the new global quantity-discount creation option**

Change the marketing form to:

```tsx
<select name="type">
  <option value="coupon">折扣碼</option>
  <option value="threshold_gift">滿額贈</option>
</select>
```

Keep the `quantity_discount: '滿件折'` label in the record display map so historical rows still render. Do not delete or migrate historical promotion records.

- [ ] **Step 3: Run browser tests locally**

Run:

```bash
pnpm exec playwright test tests/e2e/local-admin-product.spec.ts tests/e2e/storefront-interactions.spec.ts
```

Expected: both new acceptance flows PASS on the local fixture environment.

- [ ] **Step 4: Commit the completed user flow**

```bash
git add src/app/admin/marketing/page.tsx tests/e2e/local-admin-product.spec.ts tests/e2e/storefront-interactions.spec.ts
git commit -m "test: cover product quantity pricing flow"
```

---

### Task 8: Full verification, Supabase release and Vercel deployment

**Files:**
- Verify all files changed in Tasks 1–7.
- Do not modify `next-env.d.ts` or `tsconfig.tsbuildinfo`.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: linked production migration and a Vercel production deployment reported `Ready` and aliased to `https://moribebe.com`.

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
pnpm exec vitest run
pnpm exec playwright test
pnpm lint
pnpm build
```

Expected: all Vitest tests PASS, all Playwright tests PASS, lint exits 0, and Next.js production build completes successfully.

- [ ] **Step 2: Review the exact change set**

Run:

```bash
git status --short
git diff --check
git diff --stat HEAD~7..HEAD
git diff HEAD~7..HEAD -- . ':(exclude)next-env.d.ts' ':(exclude)tsconfig.tsbuildinfo'
```

Expected: no whitespace errors; every functional change maps to this feature; `next-env.d.ts` and `tsconfig.tsbuildinfo` remain unstaged.

- [ ] **Step 3: Run the plan self-review checks**

Run:

```bash
rg -n "跨商品|分類混搭|會員等級|買一送一|贈品|新 SKU" src supabase/migrations tests
rg -n "quantityPrices|quantity_prices|quantityDiscount|quantity_discount|quantityPricing|quantity_pricing|discountedSubtotal" src tests supabase/migrations/202607310003_product_quantity_pricing.sql
```

Expected: no out-of-scope feature implementation; naming is consistent across browser, server and database boundaries.

- [ ] **Step 4: Dry-run and apply the linked Supabase migration**

Run:

```bash
pnpm dlx supabase@latest db push --dry-run --linked
pnpm dlx supabase@latest db push --linked --yes
pnpm dlx supabase@latest migration list --linked
```

Expected: dry-run lists only the new quantity-pricing migration; apply succeeds; local and remote migration lists show the same new version.

- [ ] **Step 5: Verify production database contracts**

Use the linked Supabase SQL execution path to verify:

```sql
select relname, relrowsecurity
from pg_class
where relname = 'product_quantity_prices';

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('payment_attempts', 'orders')
  and column_name in ('quantity_discount', 'quantity_pricing', 'discount', 'coupon_code')
order by table_name, column_name;
```

Expected: `product_quantity_prices.relrowsecurity = true`; both snapshot fields exist on attempts and orders; coupon snapshot fields exist on orders.

- [ ] **Step 6: Run Supabase advisors**

Run the linked database security and performance advisors. Expected: no new warning attributable to `product_quantity_prices`, its RLS policy or the replaced functions. Record existing unrelated warnings separately rather than changing them in this feature.

- [ ] **Step 7: Push the implementation branch**

Run:

```bash
git status --short
git push origin feat/mori-store
git rev-parse HEAD
git rev-parse origin/feat/mori-store
```

Expected: the two SHAs match; only the two known generated files may remain unstaged.

- [ ] **Step 8: Deploy production**

Run: `pnpm dlx vercel@latest deploy --prod -y`

Expected: Vercel reports `Production`, then `Ready`, then `Aliased https://moribebe.com`. A deployment URL alone is not completion evidence.

- [ ] **Step 9: Smoke-test the production flow**

Verify on `https://moribebe.com`:

1. Existing products without tiers still show their original price and checkout normally.
2. Admin create/edit pages show the new multi-buy editor without saving a production product.
3. Cart refresh and checkout pages load without a browser console or server error.
4. Member and admin order details still render historical orders whose new discount fields default to zero.
5. Marketing creation no longer offers global `滿件折`.
6. The local browser acceptance run from Task 7 remains the evidence for tier creation, mixed-variant calculation and discount stacking; do not create or alter production catalog data only for a smoke test.

Expected: all six checks pass with no browser console error.

---

## Completion Criteria

- The owner can add, edit and remove up to 20 per-product quantity tiers.
- Mixed variants of one product count together and use the globally cheapest legal composition.
- A harmful tier is ignored.
- Free shipping and coupon validation use the multi-buy discounted merchandise subtotal.
- Browser preview and server checkout use the same pure calculator.
- Payment attempts and orders preserve original subtotal, quantity discount, coupon discount, shipping, payable total and applied-tier breakdown.
- Existing products, carts and orders remain compatible.
- All automated checks pass, the migration is applied, branch SHAs match, and Vercel reports the production alias as ready.
