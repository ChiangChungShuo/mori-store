# mori 童裝商城 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可在本機完整操作的 mori 童裝商城，包含商品與庫存、訪客／會員結帳、7-ELEVEN／全家測試選店、測試付款、訂單查詢及單一店主後台。

**Architecture:** 使用 Next.js App Router 建立顧客端與後台，Server Components 負責讀取，Server Actions／Route Handlers 負責寫入。Supabase 提供 PostgreSQL、Auth 與 Storage；所有價格、庫存、權限與訂單建立都在伺服器或資料庫交易中驗證，測試金流與測試超商透過可替換介面隔離。

**Tech Stack:** Node.js 20.9+、Next.js App Router、React、TypeScript、Tailwind CSS、Supabase PostgreSQL/Auth/Storage、`@supabase/ssr`、Zod、Vitest、Testing Library、Playwright。

## Global Constraints

- 第一版只販售 0–12 歲童裝，不建立成人商品或成人尺寸功能。
- 年齡快速分類固定為 `0-2`、`3-5`、`6-9`、`10-12`。
- 配送只支援 `7-ELEVEN` 與 `全家` 的測試門市選擇。
- 付款只支援站內測試成功、失敗、取消，不發生真實扣款。
- 顧客可訪客結帳，也可註冊／登入後結帳。
- 第一版只有單一 `admin` 店主角色。
- 訂單狀態固定為 `pending_payment`、`paid`、`preparing`、`shipped`、`collected`、`cancelled`。
- 價格以整數新台幣儲存；商品規格為顏色與尺寸的唯一組合。
- 視覺色票固定為 Ink Navy `#26305B`、Adventure Yellow `#FFD951`、Coral Play `#F26F65`、Pool Mint `#9EDDD1`、Soft Pink `#F9B6C5`、Paper Cream `#FFFDF6`。
- 不實作優惠券、電子發票、正式通知、貨到付款、退換貨自動化、多管理員或銷售報表。

---

## File Map

- `src/app/(store)/*`: 公開商城、商品、購物車、結帳及訂單查詢頁面。
- `src/app/(auth)/*`: 登入、註冊與驗證回呼。
- `src/app/account/*`: 會員資料與會員訂單。
- `src/app/admin/*`: 受保護的店主後台。
- `src/app/api/test-payment/route.ts`: 測試付款結果入口。
- `src/features/catalog/*`: 商品查詢、商品卡與規格選擇。
- `src/features/cart/*`: 瀏覽器購物車狀態、計價與購物車 UI。
- `src/features/checkout/*`: 顧客資料、門市、付款介面及結帳服務。
- `src/features/orders/*`: 訂單查詢、狀態轉換及呈現。
- `src/features/admin/*`: 商品與訂單後台表單及 actions。
- `src/lib/supabase/*`: browser/server/admin Supabase clients 與 session proxy。
- `src/lib/validation/*`: Zod 輸入 schema。
- `supabase/migrations/*`: schema、RLS、函式與 seed SQL。
- `tests/unit/*`: 無外部服務的商業規則測試。
- `tests/integration/*`: repository 與 action 邊界測試。
- `tests/e2e/*`: 顧客及管理員主流程。

---

### Task 1: Scaffold、測試框架與品牌基礎

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/(store)/page.tsx`
- Create: `src/components/site-header.tsx`, `src/components/site-footer.tsx`
- Create: `src/lib/money.ts`, `tests/unit/money.test.ts`, `vitest.config.ts`, `vitest.setup.ts`
- Create: `.env.example`, `README.md`

**Interfaces:**
- Produces: `formatTwd(value: number): string`，後續所有價格畫面共用。
- Produces: CSS variables `--ink`、`--yellow`、`--coral`、`--mint`、`--pink`、`--paper`。

- [ ] **Step 1: 建立 Next.js 專案與測試依賴**

Run:

```bash
pnpm create next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias '@/*' --use-pnpm
pnpm add @supabase/supabase-js @supabase/ssr zod
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test
```

Expected: `package.json` 含 `next`、`react`、`@supabase/ssr`、`vitest`、`@playwright/test`，且 Node.js 版本至少為 20.9。

- [ ] **Step 2: 先寫價格格式測試**

Create `tests/unit/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatTwd } from '@/lib/money'

describe('formatTwd', () => {
  it('formats integer Taiwan dollars without decimals', () => {
    expect(formatTwd(1680)).toBe('NT$1,680')
  })
})
```

- [ ] **Step 3: 執行測試並確認先失敗**

Run: `pnpm vitest run tests/unit/money.test.ts`

Expected: FAIL，訊息包含 `Cannot find module '@/lib/money'`。

- [ ] **Step 4: 實作最小價格工具、品牌 token 與首頁骨架**

Create `src/lib/money.ts`:

```ts
const twd = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  maximumFractionDigits: 0,
})

export function formatTwd(value: number) {
  return twd.format(value).replace('$', 'NT$')
}
```

In `src/app/globals.css`, define the approved tokens and visible focus:

```css
:root {
  --ink: #26305b;
  --yellow: #ffd951;
  --coral: #f26f65;
  --mint: #9eddd1;
  --pink: #f9b6c5;
  --paper: #fffdf6;
}

:focus-visible { outline: 3px solid var(--coral); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
}
```

Build `layout.tsx`, `site-header.tsx`, `site-footer.tsx` and the homepage shell with the approved order: announcement, navigation, hero, age shortcuts, a clearly labelled empty state reading `商品準備中，第一批新品很快見面。`, category feature, brand story, footer. Do not add catalog queries until Task 4.

- [ ] **Step 5: 驗證基礎專案**

Run: `pnpm vitest run tests/unit/money.test.ts && pnpm lint && pnpm build`

Expected: unit test PASS，lint 0 errors，production build succeeds。

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs src tests vitest.config.ts vitest.setup.ts .env.example README.md
git commit -m "feat: scaffold mori storefront"
```

---

### Task 2: Supabase schema、RLS 與型別

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202607170001_store_schema.sql`
- Create: `supabase/migrations/202607170002_store_policies.sql`
- Create: `supabase/seed.sql`
- Create: `src/types/database.ts`, `src/types/store.ts`
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`, `src/lib/supabase/proxy.ts`
- Create: `proxy.ts`
- Test: `tests/unit/order-status.test.ts`

**Interfaces:**
- Produces: `AgeBand = '0-2' | '3-5' | '6-9' | '10-12'`。
- Produces: `OrderStatus = 'pending_payment' | 'paid' | 'preparing' | 'shipped' | 'collected' | 'cancelled'`。
- Produces: `createClient()` browser/server variants and `createAdminClient()` server-only variant。

- [ ] **Step 1: 先寫訂單狀態轉換測試**

Create `tests/unit/order-status.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { canTransitionOrder } from '@/features/orders/status'

describe('canTransitionOrder', () => {
  it('allows the normal fulfillment path', () => {
    expect(canTransitionOrder('paid', 'preparing')).toBe(true)
    expect(canTransitionOrder('preparing', 'shipped')).toBe(true)
  })

  it('rejects moving a collected order backwards', () => {
    expect(canTransitionOrder('collected', 'preparing')).toBe(false)
  })
})
```

- [ ] **Step 2: 執行並確認失敗**

Run: `pnpm vitest run tests/unit/order-status.test.ts`

Expected: FAIL，找不到 `@/features/orders/status`。

- [ ] **Step 3: 建立資料表與原子付款函式**

Migration must create these tables with UUID primary keys and timestamps:

```sql
create type public.age_band as enum ('0-2', '3-5', '6-9', '10-12');
create type public.order_status as enum ('pending_payment', 'paid', 'preparing', 'shipped', 'collected', 'cancelled');
create type public.store_chain as enum ('seven_eleven', 'family_mart');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'customer' check (role in ('customer', 'admin'))
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  category text not null,
  age_bands public.age_band[] not null,
  material text not null default '',
  care_instructions text not null default '',
  size_guide text not null default '',
  is_new boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  position integer not null default 0
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  color text not null,
  size text not null,
  price integer not null check (price >= 0),
  compare_at_price integer check (compare_at_price is null or compare_at_price >= price),
  stock integer not null default 0 check (stock >= 0),
  unique (product_id, color, size)
);
```

Also create `store_settings`, `payment_attempts`, `orders`, and immutable `order_items`. `orders` stores nullable `user_id`, normalized lowercase `email`, recipient fields, `store_chain`, `store_id`, `store_name`, subtotal, shipping fee, total, status, and public `order_number`. `payment_attempts.provider_reference` is unique. Add a `complete_test_payment(payment_attempt_id uuid, provider_reference text)` PostgreSQL function that locks variants, verifies stock, inserts one order plus items, decrements stock, and returns the existing order for repeated provider references.

- [ ] **Step 4: 建立最小 RLS 政策與 Storage 規則**

Policies must enforce:

```sql
alter table public.products enable row level security;
create policy "published products are public"
on public.products for select
using (is_published or public.is_admin());

alter table public.orders enable row level security;
create policy "members read own orders"
on public.orders for select
using (auth.uid() = user_id or public.is_admin());
```

Add equivalent admin-only write policies for products, variants, images, settings and all-order access. Do not create a public order lookup policy; guest lookup must be a server action using the service-role client and matching both order number and normalized Email.

- [ ] **Step 5: 建立 Supabase client 與狀態 helper**

Create `src/features/orders/status.ts`:

```ts
import type { OrderStatus } from '@/types/store'

const next: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['collected'],
  collected: [],
  cancelled: [],
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus) {
  return next[from].includes(to)
}
```

Use `@supabase/ssr` cookie clients in `client.ts` and `server.ts`; `admin.ts` must include `import 'server-only'` and only read `SUPABASE_SECRET_KEY`. `proxy.ts` must refresh auth cookies without caching authenticated responses.

- [ ] **Step 6: 套用 schema 並產生型別**

Run:

```bash
pnpm dlx supabase@latest link --project-ref "$SUPABASE_PROJECT_REF"
pnpm dlx supabase@latest db push
pnpm dlx supabase@latest gen types typescript --linked > src/types/database.ts
```

Expected: migrations apply successfully and `src/types/database.ts` contains `products`, `product_variants`, `orders` and `complete_test_payment`.

- [ ] **Step 7: 驗證與 commit**

Run: `pnpm vitest run tests/unit/order-status.test.ts && pnpm lint`

Expected: PASS and lint 0 errors。

```bash
git add supabase src/types src/lib/supabase src/features/orders/status.ts proxy.ts tests/unit/order-status.test.ts
git commit -m "feat: add store database and access policies"
```

---

### Task 3: 會員驗證與管理員保護

**Files:**
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/auth/callback/route.ts`
- Create: `src/features/auth/actions.ts`, `src/features/auth/auth-form.tsx`
- Create: `src/lib/auth/require-user.ts`, `src/lib/auth/require-admin.ts`
- Create: `src/app/account/layout.tsx`, `src/app/admin/layout.tsx`
- Test: `tests/unit/auth-redirect.test.ts`, `tests/e2e/auth.spec.ts`

**Interfaces:**
- Produces: `signIn(formData)`, `signUp(formData)`, `signOut()` server actions。
- Produces: `requireUser(): Promise<User>` and `requireAdmin(): Promise<User>`。

- [ ] **Step 1: 寫未登入與非管理員測試**

```ts
import { describe, expect, it, vi } from 'vitest'
import { resolveProtectedDestination } from '@/lib/auth/protection'

describe('protected destinations', () => {
  it('sends guests to login', () => {
    expect(resolveProtectedDestination(null, '/account')).toBe('/login?next=%2Faccount')
  })
  it('rejects customers from admin', () => {
    expect(resolveProtectedDestination({ role: 'customer' }, '/admin')).toBe('/403')
  })
})
```

- [ ] **Step 2: 確認測試失敗後實作保護函式與頁面**

Run: `pnpm vitest run tests/unit/auth-redirect.test.ts`

Expected: FAIL before `protection.ts` exists。

Implement `resolveProtectedDestination`, then make `requireUser` and `requireAdmin` query the authenticated user and `profiles.role`. Preserve a safe relative `next` path only; reject absolute URLs. Auth actions validate Email and a minimum 8-character password with Zod and return field errors instead of throwing raw Supabase errors.

- [ ] **Step 3: 建立登入、註冊、callback 與登出 UI**

Auth result shape:

```ts
export type AuthActionState = {
  ok: boolean
  fieldErrors?: { email?: string[]; password?: string[] }
  message?: string
}
```

After sign-in redirect to the validated `next` path or `/account`; after sign-up show Email verification guidance. Account and admin layouts must call the corresponding guard before rendering children.

- [ ] **Step 4: 驗證與 commit**

Run: `pnpm vitest run tests/unit/auth-redirect.test.ts && pnpm lint && pnpm build`

Expected: PASS, lint 0 errors, build succeeds。

```bash
git add src/app/'(auth)' src/app/auth src/app/account src/app/admin src/features/auth src/lib/auth tests/unit/auth-redirect.test.ts
git commit -m "feat: add customer and admin authentication"
```

---

### Task 4: 商品目錄、篩選、商品頁與購物車

**Files:**
- Create: `src/features/catalog/queries.ts`, `src/features/catalog/product-card.tsx`, `src/features/catalog/product-filters.tsx`, `src/features/catalog/variant-picker.tsx`
- Create: `src/app/(store)/products/page.tsx`, `src/app/(store)/products/[slug]/page.tsx`
- Modify: `src/app/(store)/page.tsx`
- Create: `src/features/cart/types.ts`, `src/features/cart/reducer.ts`, `src/features/cart/cart-provider.tsx`, `src/features/cart/cart-drawer.tsx`, `src/features/cart/totals.ts`
- Create: `src/app/(store)/cart/page.tsx`
- Test: `tests/unit/cart.test.ts`, `tests/unit/filters.test.ts`, `tests/e2e/catalog.spec.ts`

**Interfaces:**
- Produces: `listProducts(filters: ProductFilters)` and `getProductBySlug(slug: string)`。
- Produces: `CartItem { variantId, productSlug, name, imageUrl, color, size, unitPrice, quantity, maxStock }`。
- Produces: `calculateCart(items, shippingFee, freeShippingThreshold)`。

- [ ] **Step 1: 先寫購物車與免運測試**

```ts
import { describe, expect, it } from 'vitest'
import { calculateCart } from '@/features/cart/totals'

describe('calculateCart', () => {
  it('charges shipping below the threshold', () => {
    expect(calculateCart([{ unitPrice: 590, quantity: 2 }], 65, 1500)).toEqual({ subtotal: 1180, shipping: 65, total: 1245 })
  })
  it('waives shipping at the threshold', () => {
    expect(calculateCart([{ unitPrice: 750, quantity: 2 }], 65, 1500).shipping).toBe(0)
  })
})
```

- [ ] **Step 2: 確認失敗後實作純函式與 reducer**

Run: `pnpm vitest run tests/unit/cart.test.ts`

Expected: FAIL before implementation。

Implement `calculateCart`; reducer actions are `add`, `setQuantity`, `remove`, `clear`, and cap quantity at `maxStock`. Persist only cart items in `localStorage` under `mori-cart-v1`; totals are always recalculated.

- [ ] **Step 3: 實作商品查詢、首頁與商品列表**

`ProductFilters` must be:

```ts
export type ProductFilters = {
  age?: '0-2' | '3-5' | '6-9' | '10-12'
  size?: string
  color?: string
  category?: string
  inStock?: boolean
}
```

Only return published products to public routes. Build the approved homepage and encode filters in URL search params so browser back/forward works. Product cards show image, name, available color count, size range and minimum variant price.

- [ ] **Step 4: 實作商品詳情與規格選擇**

The variant picker must derive valid size choices from the selected color, disable zero-stock variants, announce stock changes through `aria-live`, and only enable `加入購物袋` when one concrete variant is selected.

- [ ] **Step 5: 驗證與 commit**

Run: `pnpm vitest run tests/unit/cart.test.ts tests/unit/filters.test.ts && pnpm lint && pnpm build`

Expected: all PASS and build succeeds。

```bash
git add src/app/'(store)' src/features/catalog src/features/cart tests/unit/cart.test.ts tests/unit/filters.test.ts tests/e2e/catalog.spec.ts
git commit -m "feat: add product catalog and cart"
```

---

### Task 5: 結帳、測試門市與冪等付款

**Files:**
- Create: `src/lib/validation/checkout.ts`
- Create: `src/features/checkout/types.ts`, `src/features/checkout/store-picker.tsx`, `src/features/checkout/checkout-form.tsx`, `src/features/checkout/service.ts`, `src/features/checkout/test-payment.ts`
- Create: `src/app/(store)/checkout/page.tsx`, `src/app/(store)/checkout/payment/[attemptId]/page.tsx`
- Create: `src/app/api/test-payment/route.ts`
- Create: `src/app/(store)/order-complete/[orderNumber]/page.tsx`
- Test: `tests/unit/checkout.test.ts`, `tests/integration/payment.test.ts`, `tests/e2e/guest-checkout.spec.ts`

**Interfaces:**
- Produces: `CheckoutInput` validated by `checkoutSchema`。
- Produces: `createPaymentAttempt(input, cart): Promise<{ attemptId: string }>`。
- Produces: `completeTestPayment(attemptId, outcome): Promise<PaymentResult>`。
- Consumes: `complete_test_payment` database function from Task 2。

- [ ] **Step 1: 寫結帳驗證與付款冪等測試**

```ts
import { describe, expect, it } from 'vitest'
import { checkoutSchema } from '@/lib/validation/checkout'

describe('checkoutSchema', () => {
  it('accepts a Taiwan mobile and supported store', () => {
    const result = checkoutSchema.safeParse({
      email: 'parent@example.com', recipientName: '王小美', phone: '0912345678',
      chain: 'seven_eleven', storeId: '123456', storeName: '台北門市',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unsupported stores', () => {
    expect(checkoutSchema.safeParse({ chain: 'hilife' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: 確認失敗後實作 schema 與測試門市資料**

Run: `pnpm vitest run tests/unit/checkout.test.ts`

Expected: FAIL before schema exists。

The test store list contains at least two stores per supported chain and returns `{ chain, storeId, storeName, address }`. The form requires Email, recipient name, Taiwan mobile, chain, store ID and store name.

- [ ] **Step 3: 實作伺服器端重新計價與付款 attempt**

`createPaymentAttempt` receives only variant IDs and quantities from the browser, reloads current variants and settings with the server client, rejects unpublished/out-of-stock variants, recalculates totals, and stores a snapshot. Never accept browser unit prices.

- [ ] **Step 4: 實作測試付款 route**

POST body is:

```ts
type TestPaymentRequest = {
  attemptId: string
  outcome: 'success' | 'failure' | 'cancelled'
}
```

For failure/cancelled, update the attempt and return the retry URL. For success, generate one provider reference per button submission, call the database function, and redirect to `/order-complete/{orderNumber}`. Replaying the same provider reference must return the same order.

- [ ] **Step 5: 驗證訪客主流程與 commit**

Run: `pnpm vitest run tests/unit/checkout.test.ts tests/integration/payment.test.ts && pnpm playwright test tests/e2e/guest-checkout.spec.ts`

Expected: validation, idempotency and guest checkout tests PASS。

```bash
git add src/app/'(store)'/checkout src/app/'(store)'/order-complete src/app/api/test-payment src/features/checkout src/lib/validation tests/unit/checkout.test.ts tests/integration/payment.test.ts tests/e2e/guest-checkout.spec.ts
git commit -m "feat: add test checkout and payment flow"
```

---

### Task 6: 會員訂單與訪客訂單查詢

**Files:**
- Create: `src/features/orders/queries.ts`, `src/features/orders/order-card.tsx`, `src/features/orders/guest-lookup.ts`
- Create: `src/app/account/page.tsx`, `src/app/account/orders/page.tsx`, `src/app/account/orders/[orderNumber]/page.tsx`
- Create: `src/app/(store)/order-lookup/page.tsx`
- Test: `tests/integration/order-access.test.ts`, `tests/e2e/member-checkout.spec.ts`

**Interfaces:**
- Produces: `listOrdersForUser(userId)` and `getOrderForUser(orderNumber, userId)`。
- Produces: `lookupGuestOrder(orderNumber, email)` using a server-only admin client。

- [ ] **Step 1: 寫訂單存取邊界測試**

```ts
it('requires both order number and normalized email for guest lookup', async () => {
  expect(await lookupGuestOrder('MORI-260717-0001', 'wrong@example.com')).toBeNull()
  expect(await lookupGuestOrder('MORI-260717-0001', ' PARENT@EXAMPLE.COM ')).toMatchObject({ orderNumber: 'MORI-260717-0001' })
})
```

- [ ] **Step 2: 確認失敗後實作 queries 與頁面**

Run: `pnpm vitest run tests/integration/order-access.test.ts`

Expected: FAIL before query implementation。

Normalize Email with `trim().toLowerCase()`. Return the same generic `查無訂單，請確認訂單編號與 Email` for all guest lookup misses. Member queries require `auth.uid() = user_id` through RLS.

- [ ] **Step 3: 實作會員結帳關聯**

When authenticated, `createPaymentAttempt` records `user_id`; never accept a user ID from form data. Member order pages show status, items, totals, recipient and store details.

- [ ] **Step 4: 驗證與 commit**

Run: `pnpm vitest run tests/integration/order-access.test.ts && pnpm playwright test tests/e2e/member-checkout.spec.ts`

Expected: wrong users cannot read the order; member checkout and order history PASS。

```bash
git add src/app/account src/app/'(store)'/order-lookup src/features/orders tests/integration/order-access.test.ts tests/e2e/member-checkout.spec.ts
git commit -m "feat: add member and guest order lookup"
```

---

### Task 7: 商品與庫存後台

**Files:**
- Create: `src/lib/validation/product.ts`
- Create: `src/features/admin/product-actions.ts`, `src/features/admin/product-form.tsx`, `src/features/admin/variant-grid.tsx`, `src/features/admin/image-uploader.tsx`
- Create: `src/app/admin/page.tsx`, `src/app/admin/products/page.tsx`, `src/app/admin/products/new/page.tsx`, `src/app/admin/products/[id]/edit/page.tsx`
- Test: `tests/unit/product-validation.test.ts`, `tests/integration/admin-products.test.ts`, `tests/e2e/admin-product.spec.ts`

**Interfaces:**
- Produces: `createProduct`, `updateProduct`, `setProductPublished`, `uploadProductImage` server actions。

- [ ] **Step 1: 寫商品規格驗證測試**

```ts
it('rejects duplicate color and size combinations', () => {
  const result = productSchema.safeParse({
    name: '彩色口袋 Tee', slug: 'color-pocket-tee', category: 'tops', ageBands: ['3-5'],
    variants: [
      { sku: 'TEE-Y-100', color: '黃色', size: '100', price: 590, stock: 3 },
      { sku: 'TEE-Y-101', color: '黃色', size: '100', price: 590, stock: 2 },
    ],
  })
  expect(result.success).toBe(false)
})
```

- [ ] **Step 2: 確認失敗後實作 Zod schema**

Run: `pnpm vitest run tests/unit/product-validation.test.ts`

Expected: FAIL before schema exists。

Require name, slug, category, at least one age band, and at least one unique variant. Validate non-negative integer price/stock, unique SKU, unique color+size, and `compareAtPrice >= price` when present.

- [ ] **Step 3: 實作商品 CRUD、圖片與預覽**

All actions call `requireAdmin`. Upload only JPEG, PNG or WebP up to 5 MB, generate a unique storage path, require alt text, and delete newly uploaded files if the product transaction fails. Publishing requires at least one image and one in-stock variant.

- [ ] **Step 4: 實作後台 UI**

Products page shows thumbnail, name, published state, total stock and low-stock marker. Form supports approved fields and an explicit Save button. Variant grid lets the admin add/remove color-size rows without introducing a generic variant builder abstraction.

- [ ] **Step 5: 驗證與 commit**

Run: `pnpm vitest run tests/unit/product-validation.test.ts tests/integration/admin-products.test.ts && pnpm playwright test tests/e2e/admin-product.spec.ts`

Expected: product create/edit/publish and storefront visibility PASS。

```bash
git add src/app/admin src/features/admin src/lib/validation/product.ts tests/unit/product-validation.test.ts tests/integration/admin-products.test.ts tests/e2e/admin-product.spec.ts
git commit -m "feat: add product inventory admin"
```

---

### Task 8: 訂單後台、設定與儀表板

**Files:**
- Create: `src/features/admin/order-actions.ts`, `src/features/admin/settings-actions.ts`, `src/features/admin/dashboard-queries.ts`
- Create: `src/app/admin/orders/page.tsx`, `src/app/admin/orders/[orderNumber]/page.tsx`, `src/app/admin/settings/page.tsx`
- Modify: `src/app/admin/page.tsx`
- Test: `tests/integration/admin-orders.test.ts`, `tests/e2e/admin-fulfillment.spec.ts`

**Interfaces:**
- Produces: `updateOrderStatus(orderId, nextStatus)` with transition validation。
- Produces: `updateStoreSettings({ shippingFee, freeShippingThreshold, contactEmail })`。

- [ ] **Step 1: 寫非法狀態轉換與設定驗證測試**

```ts
it('does not move collected orders back to preparing', async () => {
  await expect(updateOrderStatus(collectedOrderId, 'preparing')).rejects.toThrow('無法變更為此狀態')
})

it('rejects negative shipping fees', () => {
  expect(settingsSchema.safeParse({ shippingFee: -1, freeShippingThreshold: 1500 }).success).toBe(false)
})
```

- [ ] **Step 2: 確認失敗後實作 actions**

Run: `pnpm vitest run tests/integration/admin-orders.test.ts`

Expected: FAIL before actions exist。

All actions call `requireAdmin`, reload the current order before transition, use `canTransitionOrder`, and record `updated_at`. Settings use non-negative integers; blank free-shipping threshold means no free shipping.

- [ ] **Step 3: 實作訂單列表、詳情、設定與儀表板**

Orders list filters by order number, recipient, Email and status. Detail displays immutable ordered item names/specs/prices, test payment, store and recipient. Dashboard counts today’s orders, `paid`/`preparing` backlog and variants with stock `<= 3`.

- [ ] **Step 4: 驗證與 commit**

Run: `pnpm vitest run tests/integration/admin-orders.test.ts && pnpm playwright test tests/e2e/admin-fulfillment.spec.ts`

Expected: normal fulfillment path PASS and invalid transition is blocked。

```bash
git add src/app/admin src/features/admin tests/integration/admin-orders.test.ts tests/e2e/admin-fulfillment.spec.ts
git commit -m "feat: add order fulfillment admin"
```

---

### Task 9: 完整驗收、響應式與本機操作文件

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/accessibility.spec.ts`, `tests/e2e/mobile.spec.ts`
- Modify: `README.md`, `.env.example`, `src/app/globals.css`
- Create: `docs/local-setup.md`

**Interfaces:**
- Consumes all previous customer, member and admin routes.
- Produces a repeatable local setup and one-command verification path.

- [ ] **Step 1: 建立 Playwright desktop/mobile projects**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  webServer: { command: 'pnpm dev', url: 'http://127.0.0.1:3000', reuseExistingServer: true },
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], viewport: { width: 375, height: 812 } } },
  ],
})
```

- [ ] **Step 2: 新增鍵盤、標籤與 mobile overflow 驗收**

`accessibility.spec.ts` must tab through header, product controls and checkout, asserting visible focus. Every checkout input must have a programmatic label and errors connected with `aria-describedby`. `mobile.spec.ts` must assert `document.documentElement.scrollWidth <= window.innerWidth` on homepage, product, cart and checkout at 375 px.

- [ ] **Step 3: 撰寫本機設定文件**

`docs/local-setup.md` must include exact steps for:

```bash
pnpm install
cp .env.example .env.local
pnpm dlx supabase@latest link --project-ref YOUR_PROJECT_REF
pnpm dlx supabase@latest db push
pnpm dev
```

Document where to copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, how to mark the first profile as `admin`, how to seed sample products, and that test payments never charge money.

- [ ] **Step 4: 執行完整驗證**

Run:

```bash
pnpm vitest run
pnpm lint
pnpm build
pnpm playwright test
```

Expected: all unit/integration/E2E tests PASS, lint 0 errors, production build succeeds on Node.js 20.9+。

- [ ] **Step 5: 人工驗收**

Run `pnpm dev` and verify:

1. Admin creates and publishes one multi-variant product.
2. Guest checks out successfully with a 7-ELEVEN store.
3. Member checks out successfully with a FamilyMart store and sees order history.
4. Replaying a successful payment does not duplicate the order or decrement stock twice.
5. Admin advances the order through preparing, shipped and collected.
6. Desktop 1440 px and mobile 375 px complete the same primary flow.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e README.md .env.example docs/local-setup.md src/app/globals.css
git commit -m "test: verify complete mori store flow"
```
