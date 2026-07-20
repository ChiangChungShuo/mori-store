# mori Local Member and Admin Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在沒有 Supabase 憑證的本機環境完成多商品、會員登入註冊、購物車數量操作、測試付款，以及老闆查看同一筆訂單的完整流程。

**Architecture:** 以 `MORI_E2E_FIXTURES=1` 與非 production 環境作為唯一示範模式開關。商品、驗證、付款、會員訂單與管理後台透過同一份伺服器端 fixture store 溝通；正式環境仍使用既有 Supabase repositories，頁面元件不接觸資料來源判斷。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Supabase SSR、Zod、Vitest、Testing Library、Playwright、CSS、OpenAI image generation。

## Global Constraints

- 本機功能只在 `process.env.NODE_ENV !== 'production' && process.env.MORI_E2E_FIXTURES === '1'` 時啟用。
- 正式環境不得接受 `admin@mori.tw / mori123456`，仍由 Supabase `profiles.role = admin` 判斷。
- 本機 session 使用伺服器端隨機識別碼及 HttpOnly、SameSite=Lax、Path=/ Cookie。
- 單項購物車數量最高為商品庫存與 99 的較小值，最低為 1。
- 商品年齡層必須覆蓋 `0-2`、`3-5`、`6-9`、`10-12`。
- 本機資料只需在目前開發伺服器生命週期內保存；重啟後回復種子資料。
- 不新增資料庫、Docker 或正式金流依賴。
- 所有新行為必須先看到對應測試因功能缺少而失敗，再寫最小實作。
- 桌機與 375px 手機不得橫向溢出，鍵盤焦點與停用狀態必須清楚。

---

## File Structure

### New files

- `src/testing/e2e-mode.ts`：唯一的 fixture mode 判斷。
- `src/testing/e2e-store.ts`：共用伺服器端使用者、session、付款交易與訂單狀態。
- `src/testing/e2e-auth-repository.ts`：本機註冊、登入、登出與 session Cookie。
- `src/testing/e2e-order-repository.ts`：本機會員與管理員訂單查詢、篩選及狀態更新。
- `tests/unit/e2e-store.test.ts`：共用 fixture state 與正式環境隔離。
- `tests/integration/fixture-auth.test.ts`：本機會員與管理員驗證。
- `tests/integration/fixture-orders.test.ts`：付款、會員與後台共用訂單資料。
- `tests/e2e/local-member-admin.spec.ts`：瀏覽器完整會員與老闆流程。
- `public/images/products/*.jpg`：八張新增商品圖。

### Modified files

- `src/testing/e2e-storefront-fixtures.ts`：8 款商品、篩選及 variant lookup。
- `src/testing/e2e-checkout-repository.ts`：改用共用 store，付款完成時建立完整訂單。
- `src/features/catalog/queries.ts`：沿用 fixture product API，不改正式查詢。
- `src/features/checkout/service.ts`：fixture repository resolver 沿用共用 mode 判斷。
- `src/features/auth/actions.ts`：依環境選擇 fixture 或 Supabase 驗證。
- `src/features/auth/auth-form.tsx`：完整登入註冊 UI、顯示密碼與示範說明。
- `src/lib/auth/require-user.ts`、`src/lib/auth/require-admin.ts`：依環境讀取 fixture session 或 Supabase。
- `src/features/orders/queries.ts`：本機會員訂單查詢。
- `src/features/admin/order-actions.ts`、`src/features/admin/dashboard-queries.ts`：本機管理查詢與狀態更新。
- `src/features/cart/cart-page-client.tsx`、`src/app/globals.css`：數量步進器狀態與完整頁面視覺。
- `src/components/site-header.tsx`：加入會員與老闆後台入口。
- `src/app/admin/page.tsx`、`src/app/admin/orders/page.tsx`、`src/features/admin/order-list.tsx`：後台資訊與響應式呈現。
- 既有 unit、integration、e2e tests：更新單商品與舊數量下拉選單假設。

---

### Task 1: Centralize Fixture Mode and Shared Server State

**Files:**
- Create: `src/testing/e2e-mode.ts`
- Create: `src/testing/e2e-store.ts`
- Test: `tests/unit/e2e-store.test.ts`
- Modify: `src/lib/supabase/proxy.ts`
- Modify: `src/features/checkout/service.ts`

**Interfaces:**
- Produces: `isE2EMode(environment?: E2EEnvironment): boolean`
- Produces: `createE2EStore(): E2EStoreState`
- Produces: `getE2EStore(): E2EStoreState`
- `E2EStoreState` owns `users`, `sessions`, `attempts`, and `orders` Maps.

- [ ] **Step 1: Write the failing fixture-mode and isolated-store tests**

```ts
import { describe, expect, it } from 'vitest'
import { isE2EMode } from '@/testing/e2e-mode'
import { createE2EStore } from '@/testing/e2e-store'

describe('local fixture store', () => {
  it('enables fixtures only outside production with the explicit flag', () => {
    expect(isE2EMode({ NODE_ENV: 'development', MORI_E2E_FIXTURES: '1' })).toBe(true)
    expect(isE2EMode({ NODE_ENV: 'production', MORI_E2E_FIXTURES: '1' })).toBe(false)
    expect(isE2EMode({ NODE_ENV: 'development' })).toBe(false)
  })

  it('creates independent stores with the admin seed and an order seed', () => {
    const first = createE2EStore()
    const second = createE2EStore()
    first.sessions.set('session-a', { userId: 'admin', createdAt: new Date().toISOString() })
    expect(second.sessions.size).toBe(0)
    expect([...first.users.values()]).toContainEqual(expect.objectContaining({
      email: 'admin@mori.tw', role: 'admin',
    }))
    expect(first.orders.size).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm exec vitest run tests/unit/e2e-store.test.ts`

Expected: FAIL because `@/testing/e2e-mode` and `@/testing/e2e-store` do not exist.

- [ ] **Step 3: Implement the mode helper and state factory**

```ts
// src/testing/e2e-mode.ts
export type E2EEnvironment = { NODE_ENV?: string; MORI_E2E_FIXTURES?: string }

export function isE2EMode(environment: E2EEnvironment = process.env) {
  return environment.NODE_ENV !== 'production' && environment.MORI_E2E_FIXTURES === '1'
}
```

Define `E2EUser`, `E2ESession`, `E2EAttempt`, and `E2EOrder` in `e2e-store.ts`. Seed one admin and one paid order, create fresh Maps in `createE2EStore`, and cache only `getE2EStore` on `globalThis.__moriE2EStore`.

```ts
export type E2EStoreState = {
  users: Map<string, E2EUser>
  sessions: Map<string, E2ESession>
  attempts: Map<string, E2EAttempt>
  orders: Map<string, E2EOrder>
}

export function createE2EStore(): E2EStoreState {
  return {
    users: new Map([[ADMIN_USER.id, { ...ADMIN_USER }]]),
    sessions: new Map(),
    attempts: new Map(),
    orders: new Map([[SEED_ORDER.orderNumber, structuredClone(SEED_ORDER)]]),
  }
}

export function getE2EStore() {
  fixtureGlobal.__moriE2EStore ??= createE2EStore()
  return fixtureGlobal.__moriE2EStore
}
```

Replace duplicated mode conditions in proxy and checkout resolver with `isE2EMode()`.

- [ ] **Step 4: Run focused and existing runtime tests**

Run: `pnpm exec vitest run tests/unit/e2e-store.test.ts tests/unit/runtime-config.test.ts tests/unit/web-runtime.test.ts`

Expected: PASS with no Supabase client construction in fixture mode.

- [ ] **Step 5: Commit this task**

```bash
git add src/testing/e2e-mode.ts src/testing/e2e-store.ts src/lib/supabase/proxy.ts src/features/checkout/service.ts tests/unit/e2e-store.test.ts
git commit -m "feat: centralize local demo state"
```

---

### Task 2: Add Eight Realistic Kidswear Products

**Files:**
- Modify: `src/testing/e2e-storefront-fixtures.ts`
- Modify: `src/testing/e2e-checkout-repository.ts`
- Modify: `tests/unit/filters.test.ts`
- Modify: `tests/unit/cart-refresh.test.ts`
- Create: `public/images/products/mori-tree-tee.jpg`
- Create: `public/images/products/mori-cloud-romper.jpg`
- Create: `public/images/products/mori-everyday-pants.jpg`
- Create: `public/images/products/mori-meadow-dress.jpg`
- Create: `public/images/products/mori-wind-jacket.jpg`
- Create: `public/images/products/mori-knit-vest.jpg`
- Create: `public/images/products/mori-pocket-shirt.jpg`
- Create: `public/images/products/mori-denim-overalls.jpg`

**Interfaces:**
- Produces: `E2E_PRODUCTS: readonly CatalogProduct[]`
- Preserves: `E2E_PRODUCT` as `E2E_PRODUCTS[0]` for compatible tests.
- Produces: `getE2EVariants(variantIds: string[]): CheckoutVariant[]` for checkout pricing.

- [ ] **Step 1: Write failing catalog tests**

```ts
it('offers eight fixture products across every age band and category', async () => {
  const products = await listProducts({})
  expect(products).toHaveLength(8)
  expect(new Set(products.flatMap((product) => product.ageBands)))
    .toEqual(new Set(['0-2', '3-5', '6-9', '10-12']))
  expect([...new Set(products.map((product) => product.category))])
    .toEqual(expect.arrayContaining(['上衣', '褲裝', '洋裝', '外套', '幼兒服']))
  expect(products.every((product) => product.imageUrl?.startsWith('/images/products/'))).toBe(true)
})

it('refreshes variants belonging to different fixture products', async () => {
  const result = await refreshCart([
    { variantId: '00000000-0000-4000-8000-000000000001', quantity: 1 },
    { variantId: '00000000-0000-4000-8000-000000000101', quantity: 1 },
  ])
  expect(result.items.map((item) => item.name)).toEqual([
    '有機棉小樹 T 恤', '雲朵包屁衣',
  ])
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm exec vitest run tests/unit/filters.test.ts tests/unit/cart-refresh.test.ts`

Expected: FAIL because the fixture currently exposes only one product.

- [ ] **Step 3: Generate the product imagery**

Use the `imagegen` skill and image generation tool for eight 4:5 editorial product photographs. Keep the prompt constant except for the garment:

```text
Editorial Taiwanese children's clothing catalog photograph for mori kids select, [GARMENT], child-safe styling on a simple wooden hanger or natural linen surface, warm daylight, muted forest green and oatmeal palette, subtle playful prop, premium independent boutique, realistic textile detail, no text, no logos, no watermark, portrait 4:5.
```

Use these garments and destinations: organic cotton sage T-shirt, cream cloud romper, navy relaxed pants, small-flower meadow dress, moss lightweight wind jacket, oatmeal knit vest, clay pocket shirt, washed denim overalls. Save optimized JPG assets at the exact paths listed above.

- [ ] **Step 4: Implement the product collection and cross-product lookup**

Build `E2E_PRODUCTS` with stable UUIDs in product blocks `000`, `100`, … `700`; each product has 2–4 variants, real stock, prices between NT$580 and NT$1,280, and the specified age/category coverage.

```ts
export const E2E_PRODUCTS: readonly CatalogProduct[] = [
  TREE_TEE,
  CLOUD_ROMPER,
  EVERYDAY_PANTS,
  MEADOW_DRESS,
  WIND_JACKET,
  KNIT_VEST,
  POCKET_SHIRT,
  DENIM_OVERALLS,
]
export const E2E_PRODUCT = E2E_PRODUCTS[0]

export function listE2EProducts(filters: ProductFilters) {
  return E2E_PRODUCTS.filter((product) => matchesProduct(product, filters))
}

export function getE2EProduct(slug: string) {
  return E2E_PRODUCTS.find((product) => product.slug === slug) ?? null
}

export function getE2ECartVariants(variantIds: string[]) {
  return E2E_PRODUCTS.flatMap((product) => product.variants
    .filter((variant) => variantIds.includes(variant.id))
    .map((variant) => toCartSnapshot(product, variant)))
}
```

Update checkout variant lookup to flatten all fixture products instead of reading `E2E_PRODUCT.variants`.

- [ ] **Step 5: Verify catalog tests and pages**

Run: `pnpm exec vitest run tests/unit/filters.test.ts tests/unit/cart-refresh.test.ts tests/unit/catalog-configuration.test.ts`

Expected: PASS; unfiltered fixture catalog returns 8 and category/age filters return only matching items.

- [ ] **Step 6: Commit this task**

```bash
git add src/testing/e2e-storefront-fixtures.ts src/testing/e2e-checkout-repository.ts tests/unit/filters.test.ts tests/unit/cart-refresh.test.ts public/images/products
git commit -m "feat: expand local kidswear catalog"
```

---

### Task 3: Finish Quantity Stepper Behavior and Visual States

**Files:**
- Modify: `tests/unit/cart.test.ts`
- Modify: `tests/e2e/mobile.spec.ts`
- Modify: `src/features/cart/cart-page-client.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: existing `cartReducer`, `getCartQuantityLimit`, and `calculateCart`.
- No new state abstraction; buttons continue dispatching `setQuantity`.

- [ ] **Step 1: Add failing interaction assertions**

```ts
it('updates quantity, line total, shipping and total through the stepper', async () => {
  window.localStorage.setItem('mori-cart-v1', JSON.stringify([{ ...pants, quantity: 1 }]))
  render(<CartProvider><CartPageClient settings={storeSettings} /></CartProvider>)
  await screen.findByText(pants.name)

  fireEvent.click(screen.getByRole('button', { name: `增加 ${pants.name} 數量` }))
  const quantity = screen.getByRole('status', { name: `${pants.name} 數量` })
  expect(quantity).toHaveTextContent('2')
  expect(quantity).toHaveAttribute('aria-live', 'polite')
  expect(screen.getAllByText('NT$1,760').length).toBeGreaterThan(0)
  expect(screen.getByText('免運')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: `減少 ${pants.name} 數量` }))
  expect(screen.getByRole('status', { name: `${pants.name} 數量` })).toHaveTextContent('1')
})
```

Add a Playwright assertion that clicks `＋`, sees quantity `2`, and confirms `document.documentElement.scrollWidth <= 375`.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm exec vitest run tests/unit/cart.test.ts && pnpm exec playwright test tests/e2e/mobile.spec.ts --project=mobile`

Expected: the new interaction or styling-state assertion fails before the final control implementation.

- [ ] **Step 3: Implement minimal component and CSS changes**

Keep semantic buttons and output. Add an aria-live announcement to the output and prevent accidental form submission.

```tsx
<output aria-label={`${item.name} 數量`} aria-live="polite">{item.quantity}</output>
```

Use fixed equal-width cells, a forest focus ring, pressed transform, and visibly muted disabled state:

```css
.quantity-stepper button { cursor: pointer; transition: background 160ms ease, color 160ms ease, transform 120ms ease; }
.quantity-stepper button:hover:not(:disabled) { background: var(--forest); color: var(--white); }
.quantity-stepper button:active:not(:disabled) { transform: scale(.92); }
.quantity-stepper button:focus-visible { position: relative; z-index: 1; outline: 2px solid var(--forest); outline-offset: 2px; }
.quantity-stepper button:disabled { cursor: not-allowed; background: #f6f6f2; color: #b8bcb3; }
```

- [ ] **Step 4: Run focused tests**

Run: `pnpm exec vitest run tests/unit/cart.test.ts && pnpm exec playwright test tests/e2e/mobile.spec.ts --project=mobile`

Expected: PASS; plus/minus update totals and mobile remains within 375px.

- [ ] **Step 5: Commit this task**

```bash
git add src/features/cart/cart-page-client.tsx src/app/globals.css tests/unit/cart.test.ts tests/e2e/mobile.spec.ts
git commit -m "fix: complete cart quantity controls"
```

---

### Task 4: Add Local Registration, Login, Session, and Guards

**Files:**
- Create: `src/testing/e2e-auth-repository.ts`
- Create: `tests/integration/fixture-auth.test.ts`
- Modify: `src/features/auth/actions.ts`
- Modify: `src/lib/auth/require-user.ts`
- Modify: `src/lib/auth/require-admin.ts`
- Modify: `src/features/checkout/service.ts`

**Interfaces:**
- Produces: `getE2ECurrentUser(): Promise<AuthenticatedUser | null>`
- Produces: `signInE2E(email, password): Promise<AuthenticatedUser | null>`
- Produces: `signUpE2E(email, password): Promise<'created' | 'duplicate'>`
- Produces: `signOutE2E(): Promise<void>`
- Produces: `AuthenticatedUser = { id: string; email: string; role: 'customer' | 'admin' }`.

- [ ] **Step 1: Write failing auth tests**

```ts
it('registers and authenticates a customer without exposing the password', async () => {
  const store = createE2EStore()
  const auth = createE2EAuthRepository(store, cookieJar)
  expect(await auth.signUp('parent@example.com', 'parent123')).toBe('created')
  expect(await auth.signUp('parent@example.com', 'parent123')).toBe('duplicate')
  expect(await auth.signIn('parent@example.com', 'wrongpass')).toBeNull()
  expect(await auth.signIn('parent@example.com', 'parent123'))
    .toEqual(expect.objectContaining({ email: 'parent@example.com', role: 'customer' }))
  expect(JSON.stringify([...store.sessions.values()])).not.toContain('parent123')
})

it('recognizes the local owner only in fixture mode', async () => {
  const user = await auth.signIn('admin@mori.tw', 'mori123456')
  expect(user?.role).toBe('admin')
  expect(await auth.currentUser()).toEqual(user)
  await auth.signOut()
  expect(await auth.currentUser()).toBeNull()
})
```

- [ ] **Step 2: Run the auth test and verify RED**

Run: `pnpm exec vitest run tests/integration/fixture-auth.test.ts`

Expected: FAIL because the fixture auth repository does not exist.

- [ ] **Step 3: Implement session repository**

Use `randomUUID()` for user and session IDs and `scryptSync` with a per-user random salt for passwords. Store only the session ID in `mori-demo-session`.

```ts
export type AuthenticatedUser = Pick<E2EUser, 'id' | 'email' | 'role'>

const SESSION_COOKIE = 'mori-demo-session'
const normalizeEmail = (email: string) => email.trim().toLowerCase()
const deriveHash = (password: string, salt: string) => scryptSync(password, salt, 32).toString('hex')

export type CookieAdapter = {
  get(name: string): { value: string } | undefined
  set(name: string, value: string, options: {
    httpOnly: boolean; maxAge: number; path: '/'; sameSite: 'lax'; secure: boolean
  }): void
  delete(name: string): void
}

export function createE2EAuthRepository(store: E2EStoreState, cookieStore: CookieAdapter) {
  return {
    async signIn(email: string, password: string) {
      const user = [...store.users.values()].find((candidate) => candidate.email === normalizeEmail(email))
      if (!user || deriveHash(password, user.passwordSalt) !== user.passwordHash) return null
      const sessionId = randomUUID()
      store.sessions.set(sessionId, { userId: user.id, createdAt: new Date().toISOString() })
      cookieStore.set(SESSION_COOKIE, sessionId, {
        httpOnly: true, maxAge: 60 * 60 * 8, path: '/', sameSite: 'lax', secure: false,
      })
      return { id: user.id, email: user.email, role: user.role }
    },
    async signUp(email: string, password: string) {
      const canonicalEmail = normalizeEmail(email)
      if ([...store.users.values()].some((user) => user.email === canonicalEmail)) return 'duplicate' as const
      const passwordSalt = randomBytes(16).toString('hex')
      const user: E2EUser = {
        id: randomUUID(), email: canonicalEmail, role: 'customer', passwordSalt,
        passwordHash: deriveHash(password, passwordSalt),
      }
      store.users.set(user.id, user)
      return 'created' as const
    },
    async currentUser() {
      const sessionId = cookieStore.get(SESSION_COOKIE)?.value
      const session = sessionId ? store.sessions.get(sessionId) : null
      const user = session ? store.users.get(session.userId) : null
      return user ? { id: user.id, email: user.email, role: user.role } : null
    },
    async signOut() {
      const sessionId = cookieStore.get(SESSION_COOKIE)?.value
      if (sessionId) store.sessions.delete(sessionId)
      cookieStore.delete(SESSION_COOKIE)
    },
  }
}
```

- [ ] **Step 4: Route auth actions and guards through fixture mode**

Preserve `credentialsSchema` and `safeNextPath`. In fixture mode, `signIn` redirects admins to `/admin`, customers to the safe next path or `/account`; `signUp` returns the success message without Email verification wording. `requireUser` redirects to `/login?next=<pathname>` only when no fixture session. `requireAdmin` redirects customers to `/403`.

Update fixture checkout `getCurrentUserId` to return the current fixture user ID instead of always returning `null`.

- [ ] **Step 5: Run auth, redirect, and access tests**

Run: `pnpm exec vitest run tests/integration/fixture-auth.test.ts tests/unit/auth-redirect.test.ts tests/unit/account-layout.test.ts tests/integration/order-access.test.ts`

Expected: PASS; production Supabase behavior tests remain unchanged.

- [ ] **Step 6: Commit this task**

```bash
git add src/testing/e2e-auth-repository.ts src/features/auth/actions.ts src/lib/auth/require-user.ts src/lib/auth/require-admin.ts src/features/checkout/service.ts tests/integration/fixture-auth.test.ts tests/unit/auth-redirect.test.ts tests/unit/account-layout.test.ts tests/integration/order-access.test.ts
git commit -m "feat: add local member and owner sessions"
```

---

### Task 5: Redesign Login and Registration Pages

**Files:**
- Modify: `src/features/auth/auth-form.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/signup/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/site-header.tsx`
- Create or Modify: `tests/unit/auth-form.test.tsx`
- Modify: `tests/e2e/accessibility.spec.ts`

**Interfaces:**
- Consumes unchanged `AuthActionState` and server action contract.
- Produces no new server API.

- [ ] **Step 1: Write failing UI and accessibility tests**

```tsx
it('renders a complete sign-in card with password visibility and owner guidance', () => {
  render(<AuthForm mode="sign-in" />)
  expect(screen.getByRole('heading', { name: '歡迎回到 mori' })).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
  expect(screen.getByLabelText('密碼')).toHaveAttribute('type', 'password')
  fireEvent.click(screen.getByRole('button', { name: '顯示密碼' }))
  expect(screen.getByLabelText('密碼')).toHaveAttribute('type', 'text')
  expect(screen.getByText('本機老闆示範帳號')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '建立會員帳號' })).toHaveAttribute('href', '/signup')
})
```

Add a sign-up assertion for `建立你的 mori 帳號`, password help text, and `前往登入`.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `pnpm exec vitest run tests/unit/auth-form.test.tsx`

Expected: FAIL because the current form has no card layout, visibility button, or demo guidance.

- [ ] **Step 3: Implement the auth page structure**

Use `.auth-shell`, `.auth-story`, `.auth-card`, `.auth-field`, and `.password-field`. Put the form first in mobile DOM reading order while placing the story left on desktop with CSS grid. Only render owner credentials when fixture mode is supplied as a server-derived prop.

```tsx
<main className="auth-shell">
  <section className="auth-story" aria-label="mori 會員服務">
    <p className="eyebrow">mori members</p>
    <h2>陪孩子，把每天穿得舒服一點。</h2>
    <p>登入後可查看訂單、取貨門市與付款狀態。</p>
    <ol className="size-track" aria-label="mori 適穿年齡">
      <li>0–2</li><li>3–5</li><li>6–9</li><li>10–12</li>
    </ol>
  </section>
  <form action={formAction} className="auth-card" noValidate>
    <p className="eyebrow">member account</p>
    <h1>{isSignIn ? '歡迎回到 mori' : '建立你的 mori 帳號'}</h1>
    <label className="auth-field" htmlFor="password">密碼</label>
    <div className="password-field">
      <input id="password" name="password" type={showPassword ? 'text' : 'password'} minLength={8} />
      <button type="button" aria-label={showPassword ? '隱藏密碼' : '顯示密碼'} onClick={() => setShowPassword((shown) => !shown)}>
        {showPassword ? '隱藏' : '顯示'}
      </button>
    </div>
    <button className="button button-wide" type="submit">
      {isSignIn ? '登入' : '建立會員帳號'}
    </button>
  </form>
</main>
```

Add `/login` as `會員登入` and `/admin` as `老闆後台` in the site header. Style inputs and buttons at least 44px high, with explicit focus-visible outlines and responsive single-column layout.

- [ ] **Step 4: Run unit and accessibility tests**

Run: `pnpm exec vitest run tests/unit/auth-form.test.tsx && pnpm exec playwright test tests/e2e/accessibility.spec.ts`

Expected: PASS; password toggle is keyboard accessible and both auth pages have no unlabeled controls.

- [ ] **Step 5: Commit this task**

```bash
git add src/features/auth/auth-form.tsx 'src/app/(auth)/login/page.tsx' 'src/app/(auth)/signup/page.tsx' src/components/site-header.tsx src/app/globals.css tests/unit/auth-form.test.tsx tests/e2e/accessibility.spec.ts
git commit -m "feat: finish member authentication pages"
```

---

### Task 6: Persist Completed Fixture Payments as Member Orders

**Files:**
- Modify: `src/testing/e2e-checkout-repository.ts`
- Modify: `src/features/orders/queries.ts`
- Create: `src/testing/e2e-order-repository.ts`
- Create: `tests/integration/fixture-orders.test.ts`
- Modify: `tests/e2e/fixture-checkout.spec.ts`

**Interfaces:**
- Produces: `createE2EOrderRepository(store): OrderQueriesRepository & AdminOrderQueryRepository & AdminOrderRepository`.
- Changes: `createFixtureCheckoutRepository(dependencies?)`, where dependencies may inject `store` and `getCurrentUserId` for isolated tests; runtime defaults use `getE2EStore()` and the current fixture session.
- Completed fixture orders include `userId`, customer/store fields, items, totals, payment, status, and timestamps.

- [ ] **Step 1: Write a failing shared-order test**

```ts
it('makes a completed member payment visible to member and admin queries', async () => {
  const store = createE2EStore()
  const checkout = createCheckoutService(createFixtureCheckoutRepository({
    store,
    getCurrentUserId: async () => 'customer-a',
  }))
  const { attemptId } = await checkout.createPaymentAttempt({
    email: 'parent@example.com',
    recipientName: '王小美',
    phone: '0912345678',
    chain: 'seven_eleven',
    storeId: '123456',
  }, [{ variantId: '00000000-0000-4000-8000-000000000001', quantity: 2 }])
  const result = await checkout.completeTestPayment(attemptId, 'success')
  const orders = createE2EOrderRepository(store)

  expect(await orders.listOrdersForUser('customer-a')).toEqual([
    expect.objectContaining({ orderNumber: result.orderNumber, total: 1500, status: 'paid' }),
  ])
  expect(await orders.listOrders({ query: result.orderNumber!, status: '' }))
    .toEqual([expect.objectContaining({ orderNumber: result.orderNumber })])
})
```

- [ ] **Step 2: Run the shared-order test and verify RED**

Run: `pnpm exec vitest run tests/integration/fixture-orders.test.ts`

Expected: FAIL because checkout currently stores only a minimal completed order and member/admin queries use Supabase.

- [ ] **Step 3: Write complete orders into the shared store**

When `completePayment` succeeds, atomically add one `E2EOrder`; repeat success returns the same order number and does not duplicate it.

```ts
const order: E2EOrder = {
  id: randomUUID(),
  orderNumber,
  userId: attempt.userId,
  email: attempt.email,
  recipientName: attempt.recipientName,
  recipientPhone: attempt.recipientPhone,
  storeChain: attempt.storeChain,
  storeId: attempt.storeId,
  storeName: attempt.storeName,
  subtotal: attempt.subtotal,
  shippingFee: attempt.shippingFee,
  total: attempt.total,
  status: 'paid',
  createdAt: now,
  items: attempt.items.map(toOrderItem),
  payment: { status: 'paid', providerReference, paidAt: now },
}
```

- [ ] **Step 4: Route member queries through the fixture repository**

In `listOrdersForUser`, `getOrderForUser`, and guest lookup, call the fixture repository when `isE2EMode()`; keep current Supabase repositories unchanged otherwise.

- [ ] **Step 5: Run order and checkout tests**

Run: `pnpm exec vitest run tests/integration/fixture-orders.test.ts tests/integration/payment.test.ts tests/integration/order-access.test.ts && pnpm exec playwright test tests/e2e/fixture-checkout.spec.ts`

Expected: PASS; repeat payment remains idempotent and member order reads the same order.

- [ ] **Step 6: Commit this task**

```bash
git add src/testing/e2e-checkout-repository.ts src/testing/e2e-order-repository.ts src/features/orders/queries.ts tests/integration/fixture-orders.test.ts tests/e2e/fixture-checkout.spec.ts
git commit -m "feat: share local checkout orders"
```

---

### Task 7: Connect Owner Dashboard, Order Search, Detail, and Status Updates

**Files:**
- Modify: `src/features/admin/order-actions.ts`
- Modify: `src/features/admin/order-server-actions.ts`
- Modify: `src/features/admin/dashboard-queries.ts`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/orders/page.tsx`
- Modify: `src/app/admin/orders/[orderNumber]/page.tsx`
- Modify: `src/features/admin/order-list.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/integration/admin-orders.test.ts`
- Modify: `tests/e2e/local-member-admin.spec.ts`

**Interfaces:**
- Consumes `createE2EOrderRepository(getE2EStore())`.
- Preserves public functions `listAdminOrders`, `getAdminOrder`, `updateOrderStatus`, and `getDashboardMetrics`.

- [ ] **Step 1: Add failing admin fixture tests**

```ts
it('filters local orders and returns a full detail for the owner', async () => {
  const repository = createE2EOrderRepository(store)
  expect(await repository.listOrders({ query: '王小美', status: 'paid' }))
    .toHaveLength(1)
  const detail = await repository.getOrder('MORI-DEMO-1001')
  expect(detail).toEqual(expect.objectContaining({
    recipientName: '王小美', storeChain: 'seven_eleven',
    items: expect.arrayContaining([expect.objectContaining({ quantity: 1 })]),
  }))
})

it('updates a local order through the valid fulfillment sequence', async () => {
  await actions.updateOrderStatus(order.id, 'preparing')
  expect((await repository.getOrder(order.orderNumber))?.status).toBe('preparing')
})
```

- [ ] **Step 2: Run admin tests and verify RED**

Run: `pnpm exec vitest run tests/integration/admin-orders.test.ts tests/integration/fixture-orders.test.ts`

Expected: FAIL because exported admin functions still construct Supabase repositories.

- [ ] **Step 3: Add environment-aware admin repositories**

Change `productionActions()` and `productionQueries()` into async resolvers. In fixture mode they use `createE2EOrderRepository(getE2EStore())` and fixture `requireAdmin`; otherwise preserve existing Supabase dependencies. Apply the same resolver pattern to dashboard counts.

```ts
async function resolvedQueries() {
  if (isE2EMode()) {
    return createAdminOrderQueries({
      repository: createE2EOrderRepository(getE2EStore()),
      requireAdmin,
    })
  }
  return createAdminOrderQueries({ repository: createSupabaseOrderQueryRepository(), requireAdmin })
}
```

- [ ] **Step 4: Finish responsive admin presentation**

Add an owner navigation bar with `商店總覽`, `訂單管理`, `商品管理`, and `返回商城`. Wrap tables in `.admin-table-scroll`; render order status as `.status-badge[data-status]`; add mobile card labels using `data-label` without duplicating order data.

```tsx
<div className="admin-table-scroll">
  <table className="admin-product-table admin-order-table">
    <thead>
      <tr><th>訂單編號</th><th>收件人</th><th>Email</th><th>金額</th><th>狀態</th><th>成立時間</th></tr>
    </thead>
    <tbody>
      {state.orders.map((order) => (
        <tr key={order.id}>
          <th data-label="訂單編號"><Link href={`/admin/orders/${order.orderNumber}`}>{order.orderNumber}</Link></th>
          <td data-label="收件人">{order.recipientName}</td>
          <td data-label="Email">{order.email}</td>
          <td data-label="金額">{formatTwd(order.total)}</td>
          <td data-label="狀態"><span className="status-badge" data-status={order.status}>{statusLabels[order.status]}</span></td>
          <td data-label="成立時間">{formatTaipeiDateTime(order.createdAt)}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

The empty state must say `尚未有訂單，請先從商城完成一筆測試付款。` and link to `/products`.
Map `seven_eleven` to `7-ELEVEN` and `family_mart` to `全家` in both order list/detail presentation; do not expose database enum values to the owner.

- [ ] **Step 5: Verify admin tests and 375px layout**

Run: `pnpm exec vitest run tests/integration/admin-orders.test.ts tests/integration/fixture-orders.test.ts && pnpm exec playwright test tests/e2e/local-member-admin.spec.ts --project=mobile`

Expected: PASS; a customer session receives `/403`, owner sees the seeded order and can open its detail without horizontal overflow.

- [ ] **Step 6: Commit this task**

```bash
git add src/features/admin/order-actions.ts src/features/admin/order-server-actions.ts src/features/admin/dashboard-queries.ts src/app/admin src/features/admin/order-list.tsx src/app/globals.css tests/integration/admin-orders.test.ts tests/e2e/local-member-admin.spec.ts
git commit -m "feat: connect local owner order dashboard"
```

---

### Task 8: Complete the End-to-End Member-to-Owner Flow

**Files:**
- Modify: `tests/e2e/local-member-admin.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`
- Modify: `tests/e2e/mobile.spec.ts`
- Modify: `README.md` if present, otherwise `docs/local-setup.md`

**Interfaces:**
- Consumes all public routes and controls from Tasks 1–7.
- Produces no production API.

- [ ] **Step 1: Write the failing browser acceptance flow**

```ts
test('registered customer pays and owner sees the same order', async ({ browser }) => {
  const customer = await browser.newContext()
  const customerPage = await customer.newPage()
  await customerPage.goto('/signup')
  await customerPage.getByLabel('Email').fill('new-parent@example.com')
  await customerPage.getByLabel('密碼').fill('parent123')
  await customerPage.getByRole('button', { name: '建立會員帳號' }).click()
  await customerPage.getByRole('link', { name: '前往登入' }).click()
  await customerPage.getByLabel('Email').fill('new-parent@example.com')
  await customerPage.getByLabel('密碼').fill('parent123')
  await customerPage.getByRole('button', { name: '登入' }).click()
  await customerPage.goto('/products/mori-organic-cotton-tee')
  await customerPage.getByRole('button', { name: '尺寸 100' }).click()
  await customerPage.getByRole('button', { name: '加入購物車' }).click()
  await customerPage.goto('/cart')
  await customerPage.getByRole('button', { name: '增加 有機棉小樹 T 恤 數量' }).click()
  await expect(customerPage.getByRole('status', { name: '有機棉小樹 T 恤 數量' })).toHaveText('2')
  await customerPage.getByRole('link', { name: '前往結帳' }).click()
  await customerPage.getByLabel('Email').fill('new-parent@example.com')
  await customerPage.getByLabel('收件人姓名').fill('王小美')
  await customerPage.getByLabel('手機號碼').fill('0912345678')
  await customerPage.getByLabel('取貨門市').selectOption('123456')
  await customerPage.getByRole('button', { name: '前往測試付款' }).click()
  await customerPage.getByRole('button', { name: '模擬付款成功' }).click()
  await expect(customerPage.getByRole('heading', { name: '訂單完成' })).toBeVisible()
  const orderNumber = new URL(customerPage.url()).pathname.split('/').at(-1)
  expect(orderNumber).toMatch(/^MORI-DEMO-/)
  await customerPage.goto('/account/orders')
  await expect(customerPage.getByRole('link', { name: orderNumber! })).toBeVisible()

  const owner = await browser.newContext()
  const ownerPage = await owner.newPage()
  await ownerPage.goto('/login?next=/admin')
  await ownerPage.getByLabel('Email').fill('admin@mori.tw')
  await ownerPage.getByLabel('密碼').fill('mori123456')
  await ownerPage.getByRole('button', { name: '登入' }).click()
  await expect(ownerPage).toHaveURL(/\/admin$/)
  await ownerPage.getByRole('link', { name: '管理訂單' }).click()
  await expect(ownerPage.getByRole('link', { name: orderNumber! })).toBeVisible()
  await ownerPage.getByRole('link', { name: orderNumber! }).click()
  await expect(ownerPage.getByText('王小美')).toBeVisible()
  await expect(ownerPage.getByText('7-ELEVEN')).toBeVisible()
  await expect(ownerPage.getByText('已付款')).toBeVisible()
})
```

- [ ] **Step 2: Run the acceptance flow and verify RED**

Run: `pnpm exec playwright test tests/e2e/local-member-admin.spec.ts`

Expected: FAIL at the first remaining missing link between registration, checkout, member order, and owner order.

- [ ] **Step 3: Add only the missing glue revealed by the acceptance test**

Keep this step limited to route copy, test IDs, safe redirects, or repository wiring required by the failing acceptance flow. Do not add persistence across server restarts, password reset, Email delivery, or local product upload.

Add local setup instructions:

```md
## 本機老闆後台

1. 啟動 `pnpm dev`。
2. 開啟 `http://127.0.0.1:3000/login?next=/admin`。
3. 使用 `admin@mori.tw` / `mori123456` 登入。
4. 在 `/admin/orders` 查看顧客完成測試付款後建立的訂單。

本機帳號與新訂單會在開發伺服器重新啟動後重置；正式環境使用 Supabase。
```

- [ ] **Step 4: Run all verification**

Run:

```bash
git diff --check
pnpm run lint
pnpm exec vitest run
pnpm run build
pnpm exec playwright test
```

Expected:

- ESLint exits 0.
- All Vitest files pass.
- Next.js production build completes with all routes generated.
- Local Playwright fixture tests pass on desktop and mobile.
- Tests requiring live Supabase remain skipped unless live credentials are explicitly supplied.

- [ ] **Step 5: Manually verify owner handoff**

Open `http://127.0.0.1:3000/login?next=/admin`, sign in with the local owner account, open `/admin/orders`, and confirm the exact order number produced by the customer flow is visible with correct items, total, store and paid status.

- [ ] **Step 6: Commit the final acceptance and documentation changes**

```bash
git add tests/e2e/local-member-admin.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/mobile.spec.ts docs/local-setup.md
git commit -m "test: verify complete local store ownership flow"
```
