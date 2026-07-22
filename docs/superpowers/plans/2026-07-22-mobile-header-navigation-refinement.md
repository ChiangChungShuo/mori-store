# MORIMUR BABY Mobile Header, Navigation, and Footer Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the storefront and admin mobile headers, move both navigation drawers to the left, expose storefront search and account controls in the header, collapse product categories, refine the cart icon, and place a smaller Footer logo beside the growth statement.

**Architecture:** Extend the existing native-dialog `MobileMenu` with an explicit left/right side contract. Keep server-owned authentication and category data in `SiteHeader`, isolate only the expandable mobile search state in a small client component, and pass the existing `CartDrawer` into the header as a slot so its mobile trigger participates in the same alignment grid without changing cart state logic. Admin and Footer changes remain in their existing layout components.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS, native `<dialog>` and `<details>`, Vitest + Testing Library, Playwright.

## Global Constraints

- Preserve all product, cart, checkout, payment, order, authentication, and admin authorization data flows.
- Use the existing MORIMUR BABY PNG through `BrandLogo`; do not redraw or regenerate the badge.
- Use inline SVG icons and add no third-party icon or navigation dependency.
- All mobile icon controls must expose at least a 44 × 44 CSS pixel hit area and a visible accessible name.
- At 375px, the storefront uses left hamburger/search, independently centered 48–52px logo, and right account/cart groups.
- At 375px, the admin uses left hamburger, independently centered logo, and right owner-home control.
- Both drawers open from the left and retain Escape, backdrop, link-close, focus-return, internal scrolling, breakpoint-close, and reduced-motion behavior.
- Mobile product categories are collapsed by default; search and account controls do not remain duplicated inside the drawer.
- Preserve desktop storefront navigation and the 768px/1440px admin sidebar behavior.
- Preserve unrelated dirty worktree changes and stage only task-owned files or hunks.

---

### Task 1: Add an Explicit Left-Side Mobile Drawer Contract

**Files:**
- Modify: `src/components/mobile-menu.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/mobile-menu.test.tsx`

**Interfaces:**
- Consumes: existing `MobileMenu` props and dialog lifecycle.
- Produces: `MobileMenu({ ariaLabel, breakpoint?, children, heading, id, side? })`, where `side?: 'left' | 'right'`, `side='right'` preserves the current default, and `data-side` is available to CSS.

- [ ] **Step 1: Add a failing side contract test**

Add to `tests/unit/mobile-menu.test.tsx`:

```tsx
it('exposes the requested drawer side without changing the default', () => {
  const { unmount } = render(
    <MobileMenu ariaLabel="主要導覽" heading="選單" id="left-menu" side="left">
      <Link href="/products">所有商品</Link>
    </MobileMenu>,
  )
  expect(screen.getByRole('dialog', { hidden: true, name: '主要導覽' }))
    .toHaveAttribute('data-side', 'left')

  unmount()
  render(
    <MobileMenu ariaLabel="後備導覽" heading="選單" id="default-menu">
      <Link href="/products">所有商品</Link>
    </MobileMenu>,
  )
  expect(screen.getByRole('dialog', { hidden: true, name: '後備導覽' }))
    .toHaveAttribute('data-side', 'right')
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/mobile-menu.test.tsx
```

Expected: FAIL because `side` and `data-side` do not exist.

- [ ] **Step 3: Implement the side prop and left-side CSS**

Update the signature in `src/components/mobile-menu.tsx`:

```tsx
export function MobileMenu({
  ariaLabel,
  breakpoint = '58rem',
  children,
  heading,
  id,
  side = 'right',
}: {
  ariaLabel: string
  breakpoint?: string
  children: ReactNode
  heading: string
  id: string
  side?: 'left' | 'right'
}) {
```

Add the side to the dialog:

```tsx
<dialog
  aria-label={ariaLabel}
  className="mobile-menu-dialog"
  data-side={side}
  id={id}
  onCancel={(event) => { event.preventDefault(); closeMenu() }}
  onClick={handleDialogClick}
  onClose={() => { setOpen(false); triggerRef.current?.focus() }}
  ref={dialogRef}
>
```

Add scoped rules in `src/app/globals.css`:

```css
.mobile-menu-dialog[data-side="left"] .mobile-menu-panel {
  margin-right: auto;
  margin-left: 0;
  box-shadow: 1rem 0 2.5rem rgb(20 32 23 / 24%);
  animation-name: mobile-menu-panel-in-left;
}

@keyframes mobile-menu-panel-in-left {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
```

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm exec vitest run tests/unit/mobile-menu.test.tsx
pnpm exec eslint src/components/mobile-menu.tsx tests/unit/mobile-menu.test.tsx
```

Expected: all mobile-menu tests pass and ESLint exits 0.

- [ ] **Step 5: Commit the drawer contract**

```bash
git add src/components/mobile-menu.tsx tests/unit/mobile-menu.test.tsx
git add -p src/app/globals.css
git diff --cached --check
git commit -m "feat: support left-side mobile drawers"
```

---

### Task 2: Build the Storefront Mobile Header and Collapsed Navigation

**Files:**
- Create: `src/components/mobile-header-search.tsx`
- Modify: `src/components/site-header.tsx`
- Modify: `src/app/(store)/layout.tsx`
- Modify: `src/features/cart/cart-drawer.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/storefront-header-contract.test.ts`
- Create: `tests/unit/mobile-header-search.test.tsx`
- Modify: `tests/e2e/mobile.spec.ts`

**Interfaces:**
- Consumes: `isSignedIn`, `categories`, existing `/products?q=` search behavior, and the existing `CartDrawer` React element.
- Produces: `SiteHeader({ cart, categories, isSignedIn }: { cart: ReactNode; categories?: string[]; isSignedIn?: boolean })` and `MobileHeaderSearch(): React.ReactElement`.

- [ ] **Step 1: Write failing search interaction tests**

Create `tests/unit/mobile-header-search.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MobileHeaderSearch } from '@/components/mobile-header-search'

describe('MobileHeaderSearch', () => {
  it('opens into a focused search field and closes back to its trigger', () => {
    render(<MobileHeaderSearch />)
    const trigger = screen.getByRole('button', { name: '開啟商品搜尋' })
    fireEvent.click(trigger)

    const input = screen.getByRole('searchbox', { name: '搜尋商品' })
    expect(input).toHaveFocus()
    expect(screen.getByRole('search')).toHaveAttribute('action', '/products')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('searchbox', { name: '搜尋商品' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes from the explicit close control', () => {
    render(<MobileHeaderSearch />)
    const trigger = screen.getByRole('button', { name: '開啟商品搜尋' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: '關閉商品搜尋' }))
    expect(screen.queryByRole('searchbox', { name: '搜尋商品' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
```

- [ ] **Step 2: Replace the storefront source contract with the approved mobile contract**

In `tests/unit/storefront-header-contract.test.ts`, retain the desktop assertions and add source assertions that require:

```ts
expect(header).toContain('MobileHeaderSearch')
expect(header).toContain('side="left"')
expect(header).toContain('store-mobile-categories')
expect(header).toMatch(/href=\{isSignedIn \? '\/account' : '\/login\?next=\/account'\}/)
expect(header).not.toContain('store-mobile-search-heading')
expect(header).not.toContain('store-mobile-account-heading')
expect(layout).toMatch(/cart=\{<CartDrawer settings=\{settings\} \/>\}/)
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/mobile-header-search.test.tsx tests/unit/storefront-header-contract.test.ts
```

Expected: FAIL because the client search and new header contract do not exist.

- [ ] **Step 4: Implement the client search control**

Create `src/components/mobile-header-search.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

export function MobileHeaderSearch() {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function closeFromEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !open) return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('keydown', closeFromEscape)
    return () => document.removeEventListener('keydown', closeFromEscape)
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return <>
    <button
      aria-controls="mobile-header-search-panel"
      aria-expanded={open}
      aria-label={open ? '收合商品搜尋' : '開啟商品搜尋'}
      className="mobile-header-icon-button mobile-search-trigger"
      onClick={() => open ? close() : setOpen(true)}
      ref={triggerRef}
      type="button"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
    </button>
    {open ? <div className="mobile-header-search-panel" id="mobile-header-search-panel">
      <form action="/products" method="get" role="search">
        <label htmlFor="mobile-header-product-search">搜尋商品</label>
        <input id="mobile-header-product-search" name="q" placeholder="搜尋商品" ref={inputRef} type="search" />
        <button aria-label="開始搜尋" type="submit">搜尋</button>
        <button aria-label="關閉商品搜尋" onClick={close} type="button">×</button>
      </form>
    </div> : null}
  </>
}
```

- [ ] **Step 5: Restructure `SiteHeader` around the C layout**

Add `ReactNode` and `MobileHeaderSearch` imports, accept a `cart` prop, and render this mobile structure inside `.site-nav` before the desktop navigation:

```tsx
<div className="store-mobile-left">
  <MobileMenu ariaLabel="主要導覽" breakpoint="36rem" heading="選單" id="store-mobile-menu" side="left">
    <div className="store-mobile-menu-links">
      <section aria-labelledby="store-mobile-products-heading">
        <h2 id="store-mobile-products-heading">商品導覽</h2>
        <Link href="/#new">新品</Link>
        <Link href="/products">所有商品</Link>
        <Link href="/#ages">依年齡</Link>
        <details className="store-mobile-categories">
          <summary>商品分類 <span aria-hidden="true">⌄</span></summary>
          <div>
            {categories.map((category) => (
              <Link href={`/products?category=${encodeURIComponent(category)}`} key={category}>{category}</Link>
            ))}
          </div>
        </details>
        <Link href="/#story">品牌故事</Link>
      </section>
      <section aria-labelledby="store-mobile-service-heading">
        <h2 id="store-mobile-service-heading">服務</h2>
        <Link href="/order-lookup">訪客查單</Link>
        <Link href="/admin">老闆後台</Link>
      </section>
    </div>
  </MobileMenu>
  <MobileHeaderSearch />
</div>
<Link href="/" className="brand" aria-label="MORIMUR BABY 首頁"><BrandLogo /></Link>
<div className="store-mobile-right">
  <Link
    aria-label={isSignedIn ? '前往會員中心' : '會員登入'}
    className="mobile-header-icon-button mobile-account-link"
    href={isSignedIn ? '/account' : '/login?next=/account'}
  >
    <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" /></svg>
  </Link>
  {cart}
</div>
```

Keep the existing `.desktop-navigation` blocks unchanged.

In `src/app/(store)/layout.tsx`, replace the separate header/cart siblings with:

```tsx
<SiteHeader
  cart={<CartDrawer settings={settings} />}
  categories={categories}
  isSignedIn={Boolean(user)}
/>
```

- [ ] **Step 6: Refine the cart SVG without changing its behavior**

Replace only the trigger path in `src/features/cart/cart-drawer.tsx`:

```tsx
<svg className="cart-icon" aria-hidden="true" viewBox="0 0 24 24">
  <path d="M4 5h2l1.5 9h9.8l1.7-6H7" />
  <circle cx="10" cy="18.5" r="1" />
  <circle cx="17" cy="18.5" r="1" />
</svg>
```

- [ ] **Step 7: Add scoped mobile header, search, category, and cart CSS**

Add the desktop-safe visibility rules, then the mobile layout:

```css
.store-mobile-left { display: none; }
.store-mobile-right { display: contents; }
.mobile-account-link { display: none; }

@media (max-width: 36rem) {
.site-nav {
  position: relative;
  width: 100%;
  min-height: 4.75rem;
  grid-template-columns: minmax(5.5rem, 1fr) auto minmax(5.5rem, 1fr);
  padding-inline: 0.5rem;
}
.store-mobile-left, .store-mobile-right { display: flex; align-items: center; }
.store-mobile-left { grid-column: 1; justify-self: start; }
.store-mobile-right { grid-column: 3; justify-self: end; }
.site-nav > .brand { position: absolute; left: 50%; width: 3.25rem; transform: translateX(-50%); }
.mobile-header-icon-button { display: grid; width: 44px; min-height: 44px; place-items: center; border: 0; background: transparent; color: var(--forest); }
.mobile-header-icon-button svg { width: 1.35rem; height: 1.35rem; fill: none; stroke: currentcolor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.6; }
.store-mobile-right .cart-drawer { position: static; }
.store-mobile-right .cart-drawer > summary { width: 44px; min-height: 44px; border: 0; box-shadow: none; }
.mobile-header-search-panel { position: absolute; z-index: 75; top: 100%; right: 0; left: 0; border-top: 1px solid var(--line); background: var(--paper); box-shadow: 0 0.7rem 1.4rem rgb(36 39 34 / 12%); padding: 0.75rem; }
.mobile-header-search-panel form { display: grid; grid-template-columns: minmax(0, 1fr) auto 44px; }
.mobile-header-search-panel label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.mobile-header-search-panel input { min-width: 0; border: 1px solid var(--line); padding: 0.75rem; }
.mobile-header-search-panel button { min-height: 44px; border: 1px solid var(--forest); background: var(--forest); color: var(--white); }
.mobile-header-search-panel button:last-child { border-left: 0; background: var(--paper); color: var(--forest); }
}
```

The base rules keep the mobile left controls and account link hidden on desktop. `display: contents` keeps the nested cart trigger available in the existing desktop position; the mobile media query turns its wrapper into the aligned right flex group.

Add non-media drawer category rules:

```css
.store-mobile-categories { border-bottom: 1px solid var(--line); }
.store-mobile-categories summary { display: flex; min-height: 3rem; align-items: center; justify-content: space-between; cursor: pointer; list-style: none; }
.store-mobile-categories summary::-webkit-details-marker { display: none; }
.store-mobile-categories[open] summary span { transform: rotate(180deg); }
.store-mobile-categories > div { display: grid; padding-left: 1rem; border-top: 1px solid var(--line); }
```

- [ ] **Step 8: Update Playwright acceptance for the full storefront interaction**

In `tests/e2e/mobile.spec.ts`, update `opens and closes the storefront navigation at 375 px` to assert:

```ts
const searchTrigger = page.getByRole('button', { name: '開啟商品搜尋' })
const accountLink = page.getByRole('link', { name: /會員登入|前往會員中心/ })
await expect(searchTrigger).toBeVisible()
await expect(accountLink).toBeVisible()

const leftGroup = page.locator('.store-mobile-left')
const rightGroup = page.locator('.store-mobile-right')
const logoCenter = await brand.evaluate((node) => {
  const box = node.getBoundingClientRect()
  return box.left + box.width / 2
})
expect(Math.abs(logoCenter - 187.5)).toBeLessThan(1)
expect(await leftGroup.evaluate((node) => node.getBoundingClientRect().width))
  .toBe(await rightGroup.evaluate((node) => node.getBoundingClientRect().width))

await searchTrigger.click()
await expect(page.getByRole('searchbox', { name: '搜尋商品' })).toBeFocused()
await page.getByRole('searchbox', { name: '搜尋商品' }).fill('小樹')
await page.getByRole('button', { name: '開始搜尋' }).click()
await expect(page).toHaveURL(/\/products\?q=%E5%B0%8F%E6%A8%B9/)
await page.goto('/')
```

After opening the drawer, assert the category is closed before interaction and that search/account headings are absent:

```ts
const categories = dialog.locator('.store-mobile-categories')
await expect(categories).not.toHaveAttribute('open', '')
await expect(dialog.getByRole('heading', { name: '搜尋' })).toHaveCount(0)
await expect(dialog.getByRole('heading', { name: '會員服務' })).toHaveCount(0)
await categories.locator('summary').click()
await expect(categories).toHaveAttribute('open', '')
await expect(categories.getByRole('link', { name: '上衣', exact: true })).toBeVisible()
```

- [ ] **Step 9: Run storefront verification**

Run:

```bash
pnpm exec vitest run tests/unit/mobile-header-search.test.tsx tests/unit/storefront-header-contract.test.ts tests/unit/mobile-menu.test.tsx
pnpm exec eslint src/components/mobile-header-search.tsx src/components/site-header.tsx src/features/cart/cart-drawer.tsx tests/unit/mobile-header-search.test.tsx tests/unit/storefront-header-contract.test.ts
```

Then run the focused 375px Playwright test against a fixture preview build.

Expected: unit tests pass; the mobile header is centered, search works, categories are collapsed, account is external, cart opens, and there is no horizontal overflow.

- [ ] **Step 10: Commit the storefront header task**

```bash
git add src/components/mobile-header-search.tsx src/components/site-header.tsx 'src/app/(store)/layout.tsx' src/features/cart/cart-drawer.tsx tests/unit/mobile-header-search.test.tsx tests/unit/storefront-header-contract.test.ts tests/e2e/mobile.spec.ts
git add -p src/app/globals.css
git diff --cached --check
git commit -m "feat: refine storefront mobile header"
```

---

### Task 3: Align the Admin Mobile Header

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/local-member-admin.spec.ts`

**Interfaces:**
- Consumes: Task 1 `MobileMenu side="left"` and the existing `BrandLogo`.
- Produces: the admin mobile grid `[menu] [centered logo] [owner home]` while preserving all drawer links and desktop/tablet sidebar behavior.

- [ ] **Step 1: Update the failing admin mobile acceptance**

In the mobile branch of `tests/e2e/local-member-admin.spec.ts`, replace the old title/logo ordering checks with:

```ts
const mobileBrand = page.getByRole('link', { name: 'MORIMUR BABY 商店後台' })
const ownerHome = page.getByRole('link', { name: '商店後台首頁' })
await expect(mobileBrand).toHaveCSS('width', '52px')
await expect(ownerHome).toBeVisible()

const triggerBox = await trigger.boundingBox()
const brandBox = await mobileBrand.boundingBox()
const ownerBox = await ownerHome.boundingBox()
expect(triggerBox).not.toBeNull()
expect(brandBox).not.toBeNull()
expect(ownerBox).not.toBeNull()
expect(triggerBox!.x).toBeLessThan(brandBox!.x)
expect(ownerBox!.x).toBeGreaterThan(brandBox!.x + brandBox!.width)
expect(Math.abs(brandBox!.x + brandBox!.width / 2 - 187.5)).toBeLessThan(1)
```

After opening the dialog, assert its panel starts at the left viewport edge:

```ts
await expect(menu).toHaveAttribute('data-side', 'left')
expect((await menu.locator('.mobile-menu-panel').boundingBox())?.x).toBe(0)
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run the mobile owner-flow Playwright test against the fixture server.

Expected: FAIL because the owner-home control and centered brand layout do not exist.

- [ ] **Step 3: Implement the admin C-aligned header**

Update only the mobile header in `src/app/admin/layout.tsx`:

```tsx
<header className="admin-mobile-header">
  <MobileMenu ariaLabel="商店後台導覽" breakpoint="36rem" heading="商店管理" id="admin-mobile-menu" side="left">
    <div className="admin-mobile-owner"><strong>mori 老闆</strong><small>商店管理員</small></div>
    <nav className="admin-mobile-nav" aria-label="手機版商店後台導覽"><AdminNavigationLinks /></nav>
    <form action={signOut}><button type="submit">登出</button></form>
  </MobileMenu>
  <Link aria-label="MORIMUR BABY 商店後台" className="admin-mobile-brand" href="/admin">
    <BrandLogo subtitle="store room" />
  </Link>
  <Link aria-label="商店後台首頁" className="admin-mobile-account" href="/admin">
    <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" /></svg>
  </Link>
</header>
```

Update the mobile admin CSS:

```css
.admin-mobile-header {
  position: sticky;
  grid-template-columns: minmax(5.5rem, 1fr) auto minmax(5.5rem, 1fr);
}
.admin-mobile-header > .mobile-menu { grid-column: 1; justify-self: start; }
.admin-mobile-brand { grid-column: 2; grid-row: 1; justify-self: center; width: 3.25rem; }
.admin-mobile-account { display: grid; width: 44px; min-height: 44px; grid-column: 3; grid-row: 1; justify-self: end; place-items: center; color: var(--white); }
.admin-mobile-account svg { width: 1.35rem; height: 1.35rem; fill: none; stroke: currentcolor; stroke-linecap: round; stroke-width: 1.6; }
```

- [ ] **Step 4: Run admin verification**

Run:

```bash
pnpm exec eslint src/app/admin/layout.tsx tests/e2e/local-member-admin.spec.ts
```

Then run the focused mobile admin Playwright test and the desktop/tablet branch.

Expected: mobile C alignment and left drawer pass; 768px static sidebar and 1440px fixed sidebar remain unchanged.

- [ ] **Step 5: Commit the admin task**

```bash
git add src/app/admin/layout.tsx tests/e2e/local-member-admin.spec.ts
git add -p src/app/globals.css
git diff --cached --check
git commit -m "feat: align admin mobile header"
```

---

### Task 4: Create the Compact Footer Brand Lockup

**Files:**
- Modify: `src/components/site-footer.tsx`
- Modify: `src/app/globals.css`
- Create: `tests/unit/site-footer.test.tsx`
- Modify: `tests/e2e/mobile.spec.ts`

**Interfaces:**
- Consumes: existing `BrandLogo` and unchanged Footer navigation/service content.
- Produces: `.footer-brand-lockup` with a compact logo on the left and `.footer-brand-copy` on the right.

- [ ] **Step 1: Write the failing Footer structure test**

Create `tests/unit/site-footer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteFooter } from '@/components/site-footer'

describe('SiteFooter', () => {
  it('places the compact brand beside the growth statement and preserves service navigation', () => {
    const { container } = render(<SiteFooter />)
    const lockup = container.querySelector('.footer-brand-lockup')
    expect(lockup).not.toBeNull()
    expect(lockup?.querySelector('.brand')).not.toBeNull()
    expect(lockup?.querySelector('.footer-brand-copy h2')).toHaveTextContent('把舒服穿進每一天的成長。')
    expect(screen.getByRole('navigation', { name: '購物指南' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '會員服務' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/site-footer.test.tsx
```

Expected: FAIL because `.footer-brand-lockup` and `.footer-brand-copy` do not exist.

- [ ] **Step 3: Implement the Footer lockup**

Replace only the contents of `.footer-brand-block` in `src/components/site-footer.tsx`:

```tsx
<section className="footer-brand-block">
  <div className="footer-brand-lockup">
    <div className="brand" aria-label="MORIMUR BABY"><BrandLogo /></div>
    <div className="footer-brand-copy">
      <h2>把舒服穿進<br />每一天的成長。</h2>
      <p>為 0–12 歲孩子選進親膚、耐穿，也能自在活動的日常服。</p>
      <a href="mailto:hello@mori.tw">hello@mori.tw</a>
    </div>
  </div>
</section>
```

Add scoped CSS:

```css
.footer-brand-lockup { display: grid; grid-template-columns: 5rem minmax(0, 1fr); gap: 1.25rem; align-items: start; }
.site-footer .footer-brand-lockup .brand { width: 5rem; margin: 0; }
.footer-brand-copy h2 { margin: 0 0 1rem; font-family: Georgia, "Noto Serif TC", serif; font-size: clamp(1.8rem, 3vw, 3rem); font-weight: 400; line-height: 1.12; }
.footer-brand-copy p { max-width: 25rem; margin: 0 0 0.75rem; color: #c8d1c7; font-size: 0.82rem; }
.footer-brand-copy a { color: var(--lime); font-size: 0.75rem; font-weight: 800; }
```

Within `@media (max-width: 36rem)`:

```css
.footer-brand-lockup { grid-template-columns: 3.75rem minmax(0, 1fr); gap: 0.9rem; }
.site-footer .footer-brand-lockup .brand { width: 3.75rem; }
.footer-brand-copy h2 { margin-bottom: 0.55rem; font-size: 1.55rem; }
.footer-brand-copy p { margin-block: 0.4rem; font-size: 0.7rem; }
```

Remove or replace old selectors that target `.footer-brand-block h2`, `.footer-brand-block > p`, and `.footer-brand-block > a` so they do not conflict with the new nested structure.

- [ ] **Step 4: Extend responsive Footer acceptance**

In the homepage mobile test, replace the brittle whole-Footer height assertion with geometry assertions:

```ts
const footerLogo = page.locator('.footer-brand-lockup .brand')
const footerCopy = page.locator('.footer-brand-copy')
await expect(footerLogo).toHaveCSS('width', '60px')
const footerLogoBox = await footerLogo.boundingBox()
const footerCopyBox = await footerCopy.boundingBox()
expect(footerLogoBox).not.toBeNull()
expect(footerCopyBox).not.toBeNull()
expect(footerLogoBox!.x + footerLogoBox!.width).toBeLessThanOrEqual(footerCopyBox!.x)
```

- [ ] **Step 5: Run Footer verification**

Run:

```bash
pnpm exec vitest run tests/unit/site-footer.test.tsx
pnpm exec eslint src/components/site-footer.tsx tests/unit/site-footer.test.tsx
```

Expected: Footer unit test passes and ESLint exits 0.

- [ ] **Step 6: Commit the Footer task**

```bash
git add src/components/site-footer.tsx tests/unit/site-footer.test.tsx tests/e2e/mobile.spec.ts
git add -p src/app/globals.css
git diff --cached --check
git commit -m "feat: compact footer brand lockup"
```

---

### Task 5: Final Responsive and Regression Verification

**Files:**
- Modify if evidence requires a task-owned fix: `src/app/globals.css`
- Modify if selectors require correction: `tests/e2e/mobile.spec.ts`
- Modify if selectors require correction: `tests/e2e/local-member-admin.spec.ts`
- Create: `output/mobile-header-refinement/375-storefront.png`
- Create: `output/mobile-header-refinement/375-storefront-menu.png`
- Create: `output/mobile-header-refinement/375-admin.png`
- Create: `output/mobile-header-refinement/375-footer.png`

**Interfaces:**
- Consumes: Tasks 1–4 completed behavior.
- Produces: fresh evidence that the approved design works across mobile, tablet, and desktop without changing unrelated flows.

- [ ] **Step 1: Run static checks**

Run:

```bash
pnpm run lint
pnpm exec tsc --noEmit --incremental false
git diff --check
```

Expected: lint and TypeScript exit 0. Record separately any pre-existing dirty-worktree whitespace outside this feature.

- [ ] **Step 2: Run the full Vitest suite**

Run:

```bash
pnpm exec vitest run
```

Expected: all task-owned tests pass. If the previously accepted `tests/integration/admin-orders.test.ts:528` copy mismatch still exists, report it separately and do not change unrelated order copy.

- [ ] **Step 3: Build the preview artifact**

Run:

```bash
VERCEL_ENV=preview pnpm run build
```

Expected: compile, TypeScript, page generation, and optimization complete; `/icon.png` remains in the route table.

- [ ] **Step 4: Run targeted Playwright acceptance**

Against an isolated fixture preview server, run:

```bash
pnpm exec playwright test tests/e2e/mobile.spec.ts --project=mobile --grep "homepage|storefront navigation"
pnpm exec playwright test tests/e2e/local-member-admin.spec.ts --grep "customer is denied while owner can manage"
```

Expected:

- 375px storefront C layout is centered and does not overflow.
- Search opens below the header, focuses, submits, and closes.
- Account link goes directly to login/account according to session state.
- Category details start closed and expand on request.
- Storefront and admin drawers start at x=0 and open from the left.
- Cart icon, count badge, drawer, and add animation still work.
- Admin C layout, five pipeline states, tablet sidebar, and desktop sidebar pass.
- Footer logo is compact and left of the statement.

- [ ] **Step 5: Capture and inspect final screenshots**

Capture 375px screenshots for the closed storefront header, open storefront menu, admin header, and Footer. Inspect that:

- the logo center is at 187.5px;
- icon strokes and 44px controls are visually consistent;
- no control overlaps the badge or quantity count;
- the drawer visibly enters from the left;
- the Footer badge is smaller and horizontally paired with the statement.

- [ ] **Step 6: Review task-owned diff and commit only necessary verification fixes**

```bash
git diff -- src/components src/features/cart 'src/app/(store)/layout.tsx' src/app/admin/layout.tsx src/app/globals.css tests/unit tests/e2e
git diff --check
```

If Task 5 required a task-owned correction, stage only that correction and commit:

```bash
git add -p src/app/globals.css tests/e2e/mobile.spec.ts tests/e2e/local-member-admin.spec.ts
git diff --cached --check
git commit -m "fix: complete mobile header refinement"
```

If no correction was required, do not create an empty commit.
