# MORIMUR BABY Mobile Navigation and Brand Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the storefront and admin mobile navigation with accessible hamburger drawers and replace the current mori mark/favicon with the supplied circular MORIMUR BABY badge.

**Architecture:** A small client-side `MobileMenu` owns the native modal dialog, focus, Escape, backdrop, and close-on-navigation behavior. Existing server-rendered storefront/admin components only provide menu content, while desktop navigation remains in place. A deterministic crop of the supplied image produces one shared logo PNG and one Next.js app icon without generative redrawing.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS, native `<dialog>`, Vitest + Testing Library, Playwright, macOS `sips` for deterministic raster cropping.

## Global Constraints

- Preserve the supplied MORIMUR BABY illustration and all embedded text exactly; do not regenerate or redraw it.
- The circular gray outer ring must remain complete while excess white space is removed.
- Desktop storefront navigation and the fixed desktop admin sidebar remain unchanged above the mobile breakpoint.
- Mobile hamburger controls must expose `aria-expanded`, `aria-controls`, visible focus, Escape close, backdrop close, link close, and trigger focus restoration.
- The mobile drawer must never exceed the viewport and must scroll internally when its content is taller than the screen.
- Respect `prefers-reduced-motion` and add no third-party navigation or icon dependency.
- Preserve all unrelated dirty worktree changes; stage only task-owned files or task-owned hunks.

---

### Task 1: Produce Exact Brand Assets and Replace `BrandLogo`

**Files:**
- Create: `public/brand/morimur-baby-logo.png`
- Create: `src/app/icon.png`
- Modify: `src/components/brand-logo.tsx`
- Modify: `src/app/globals.css`
- Delete: `src/app/icon.svg`
- Test: `tests/unit/brand-assets.test.ts`

**Interfaces:**
- Consumes: supplied source image `/var/folders/yr/bdffw9cd7ybf694vwly4gk5r0000gn/T/codex-clipboard-86236680-ba4e-4f5d-a3ac-2e42acaa88b5.png` at 1206 × 1239 pixels.
- Produces: `BrandLogo({ subtitle?: string }): React.ReactElement`, `/brand/morimur-baby-logo.png`, and the Next.js `/icon` metadata asset.

- [ ] **Step 1: Write the failing asset contract test**

Create `tests/unit/brand-assets.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readPngSize(path: string) {
  const png = readFileSync(path)
  expect(png.subarray(1, 4).toString()).toBe('PNG')
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

describe('MORIMUR BABY brand assets', () => {
  it('ships square logo and favicon PNGs from the supplied badge', () => {
    const logo = resolve(process.cwd(), 'public/brand/morimur-baby-logo.png')
    const icon = resolve(process.cwd(), 'src/app/icon.png')

    expect(existsSync(logo)).toBe(true)
    expect(existsSync(icon)).toBe(true)
    expect(readPngSize(logo)).toEqual({ width: 720, height: 720 })
    expect(readPngSize(icon)).toEqual({ width: 512, height: 512 })
  })

  it('renders the shared logo asset instead of the legacy inline svg', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/components/brand-logo.tsx'), 'utf8')

    expect(component).toContain('/brand/morimur-baby-logo.png')
    expect(component).not.toContain('<svg')
    expect(existsSync(resolve(process.cwd(), 'src/app/icon.svg'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/brand-assets.test.ts
```

Expected: FAIL because the two PNG assets do not exist and `BrandLogo` still renders the old SVG.

- [ ] **Step 3: Crop and resize the supplied image deterministically**

Run:

```bash
mkdir -p public/brand
sips --cropToHeightWidth 900 900 --cropOffset 170 153 \
  /var/folders/yr/bdffw9cd7ybf694vwly4gk5r0000gn/T/codex-clipboard-86236680-ba4e-4f5d-a3ac-2e42acaa88b5.png \
  --out /tmp/morimur-baby-square.png
sips --resampleHeightWidth 720 720 /tmp/morimur-baby-square.png \
  --out public/brand/morimur-baby-logo.png
sips --resampleHeightWidth 512 512 /tmp/morimur-baby-square.png \
  --out src/app/icon.png
```

Inspect both outputs and confirm that the full gray ring is visible, the badge is centered, and no embedded text is clipped. Remove `src/app/icon.svg` only after `src/app/icon.png` exists.

- [ ] **Step 4: Replace the inline SVG with the shared image component**

Replace `src/components/brand-logo.tsx` with:

```tsx
import Image from 'next/image'

export function BrandLogo({ subtitle = 'kids select' }: { subtitle?: string }) {
  return (
    <span className="brand-logo-lockup">
      <Image
        alt=""
        className="brand-logo-image"
        height={720}
        priority
        src="/brand/morimur-baby-logo.png"
        width={720}
      />
      <span className="sr-only">{subtitle}</span>
    </span>
  )
}
```

Replace the legacy `.brand-logo-svg`, mark, word, and subtitle rules with:

```css
.brand-logo-lockup { display: block; width: 100%; }
.brand-logo-image { display: block; width: 100%; height: auto; border-radius: 50%; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/unit/brand-assets.test.ts
pnpm exec eslint src/components/brand-logo.tsx tests/unit/brand-assets.test.ts
```

Expected: the asset contract passes and ESLint exits 0.

- [ ] **Step 6: Commit only the brand task**

```bash
git add public/brand/morimur-baby-logo.png src/app/icon.png src/app/icon.svg \
  src/components/brand-logo.tsx tests/unit/brand-assets.test.ts
git add -p src/app/globals.css
git diff --cached --check
git commit -m "feat: apply morimur baby brand assets"
```

---

### Task 2: Build the Reusable Accessible Mobile Drawer

**Files:**
- Create: `src/components/mobile-menu.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/unit/mobile-menu.test.tsx`

**Interfaces:**
- Consumes: arbitrary server-rendered `children` supplied by storefront or admin navigation.
- Produces: `MobileMenu({ ariaLabel, children, heading, id }: { ariaLabel: string; children: React.ReactNode; heading: string; id: string }): React.ReactElement`.

- [ ] **Step 1: Write failing interaction tests**

Create `tests/unit/mobile-menu.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { MobileMenu } from '@/components/mobile-menu'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

function renderMenu() {
  render(
    <MobileMenu ariaLabel="主要導覽" heading="選單" id="test-menu">
      <a href="/products">所有商品</a>
    </MobileMenu>,
  )
  return {
    dialog: screen.getByRole('dialog', { hidden: true, name: '主要導覽' }),
    trigger: screen.getByRole('button', { name: '開啟選單' }),
  }
}

describe('MobileMenu', () => {
  it('opens and closes with Escape while restoring trigger focus', () => {
    const { dialog, trigger } = renderMenu()
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(dialog).toHaveAttribute('open')

    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  it.each([
    ['close button', () => screen.getByRole('button', { name: '關閉選單' })],
    ['child link', () => screen.getByRole('link', { name: '所有商品' })],
  ])('closes from the %s', (_label, findTarget) => {
    const { dialog, trigger } = renderMenu()
    fireEvent.click(trigger)
    fireEvent.click(findTarget())
    expect(dialog).not.toHaveAttribute('open')
    expect(trigger).toHaveFocus()
  })

  it('closes when the dialog backdrop receives the click', () => {
    const { dialog, trigger } = renderMenu()
    fireEvent.click(trigger)
    fireEvent.click(dialog)
    expect(dialog).not.toHaveAttribute('open')
    expect(trigger).toHaveFocus()
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/mobile-menu.test.tsx
```

Expected: FAIL because `@/components/mobile-menu` does not exist.

- [ ] **Step 3: Implement the native-dialog drawer**

Create `src/components/mobile-menu.tsx` with this behavior:

```tsx
'use client'

import { useRef, useState, type MouseEvent, type ReactNode } from 'react'

export function MobileMenu({ ariaLabel, children, heading, id }: {
  ariaLabel: string
  children: ReactNode
  heading: string
  id: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  function openMenu() {
    dialogRef.current?.showModal()
    setOpen(true)
  }

  function closeMenu() {
    dialogRef.current?.close()
  }

  function handleDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeMenu()
  }

  return (
    <div className="mobile-menu">
      <button
        aria-controls={id}
        aria-expanded={open}
        aria-label={open ? '關閉選單' : '開啟選單'}
        className="mobile-menu-trigger"
        onClick={openMenu}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true"><i /><i /><i /></span>
      </button>
      <dialog
        aria-label={ariaLabel}
        className="mobile-menu-dialog"
        id={id}
        onCancel={(event) => { event.preventDefault(); closeMenu() }}
        onClick={handleDialogClick}
        onClose={() => { setOpen(false); triggerRef.current?.focus() }}
        ref={dialogRef}
      >
        <div className="mobile-menu-panel">
          <header>
            <strong>{heading}</strong>
            <button aria-label="關閉選單" onClick={closeMenu} type="button">×</button>
          </header>
          <div className="mobile-menu-content" onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) closeMenu()
          }}>{children}</div>
        </div>
      </dialog>
    </div>
  )
}
```

- [ ] **Step 4: Add the shared drawer styles**

Add base styles that keep `.mobile-menu` hidden on desktop and define a right-edge modal panel, `100dvh` maximum height, internal overflow, 44px controls, a forest backdrop, and three-line-to-close animation. Add a `prefers-reduced-motion: reduce` override with `transition-duration: 0s` and `animation-duration: 0s`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/unit/mobile-menu.test.tsx
pnpm exec eslint src/components/mobile-menu.tsx tests/unit/mobile-menu.test.tsx
```

Expected: all open/close/focus tests pass and ESLint exits 0.

- [ ] **Step 6: Commit the reusable drawer**

```bash
git add src/components/mobile-menu.tsx tests/unit/mobile-menu.test.tsx
git add -p src/app/globals.css
git diff --cached --check
git commit -m "feat: add accessible mobile menu drawer"
```

---

### Task 3: Integrate the Storefront Hamburger Navigation

**Files:**
- Modify: `src/components/site-header.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/mobile.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`

**Interfaces:**
- Consumes: `MobileMenu`, `BrandLogo`, `isSignedIn`, `categories`, existing wishlist/account/search routes.
- Produces: a 375px storefront header with one hamburger trigger and a complete drawer while retaining the desktop `.nav-links` and `.nav-actions`.

- [ ] **Step 1: Add failing storefront browser assertions**

In the mobile-only suite, assert:

```ts
await page.goto('/')
const trigger = page.getByRole('button', { name: '開啟選單' })
await expect(trigger).toBeVisible()
await trigger.click()
await expect(trigger).toHaveAttribute('aria-expanded', 'true')
const dialog = page.getByRole('dialog', { name: '主要導覽' })
await expect(dialog).toBeVisible()
await expect(dialog.getByRole('link', { name: '所有商品' })).toBeVisible()
await page.keyboard.press('Escape')
await expect(trigger).toHaveAttribute('aria-expanded', 'false')
await expect(trigger).toBeFocused()
await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
```

Add a desktop assertion that the hamburger trigger is hidden while `主要導覽` desktop links remain visible.

- [ ] **Step 2: Run the focused browser tests and verify RED**

Run:

```bash
PLAYWRIGHT_LOCAL_PORT=3110 pnpm exec playwright test \
  tests/e2e/mobile.spec.ts tests/e2e/accessibility.spec.ts
```

Expected: FAIL because the storefront has no mobile hamburger trigger or dialog.

- [ ] **Step 3: Add the mobile menu content to `SiteHeader`**

Keep existing desktop markup. Add `MobileMenu` before the centered brand and provide mobile-only content with:

- 新品, 所有商品, 依年齡, every current category, 品牌故事.
- The existing product search form.
- Wishlist, signed-in member links or login/signup links, guest order lookup, and owner admin entry.

Give the desktop wrappers a `desktop-navigation` class and the drawer content semantic grouped headings so the same routes remain discoverable without duplicating state logic.

- [ ] **Step 4: Add the storefront mobile layout CSS**

Within `@media (max-width: 36rem)`:

```css
.site-nav { grid-template-columns: 3rem minmax(0, 1fr) 3rem; min-height: 4.75rem; padding-block: 0.55rem; }
.site-nav > .mobile-menu { display: block; grid-column: 1; grid-row: 1; }
.site-nav > .brand { grid-column: 2; grid-row: 1; width: 4rem; justify-self: center; }
.site-nav > .nav-links, .site-nav > .nav-actions { display: none; }
.cart-drawer { top: 3.5rem; right: 1rem; bottom: auto; }
.cart-drawer > summary { width: 2.75rem; min-height: 2.75rem; justify-content: center; padding: 0; }
.cart-drawer > summary .cart-icon { width: 1.25rem; height: 1.25rem; }
.cart-drawer > summary .cart-count { position: absolute; top: -0.25rem; right: -0.25rem; width: 1.25rem; height: 1.25rem; }
.cart-drawer > summary { font-size: 0; }
.cart-drawer > summary .cart-count { font-size: 0.58rem; }
.store-mobile-menu-links { display: grid; }
.store-mobile-menu-links a { min-height: 3rem; border-bottom: 1px solid var(--line); padding: 0.75rem 0; text-decoration: none; }
```

Keep the existing cart panel, totals, and checkout behavior unchanged; only move its closed mobile trigger into the top row's right-hand position.

- [ ] **Step 5: Run storefront tests and verify GREEN**

Run the focused Playwright command again, then:

```bash
pnpm exec vitest run tests/unit/mobile-menu.test.tsx tests/unit/brand-assets.test.ts
```

Expected: storefront mobile drawer and desktop navigation assertions pass with no 375px overflow.

- [ ] **Step 6: Commit the storefront integration**

```bash
git add -p src/components/site-header.tsx src/app/globals.css \
  tests/e2e/mobile.spec.ts tests/e2e/accessibility.spec.ts
git diff --cached --check
git commit -m "feat: add storefront mobile navigation"
```

---

### Task 4: Integrate the Admin Hamburger Navigation

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/local-member-admin.spec.ts`

**Interfaces:**
- Consumes: `MobileMenu`, `BrandLogo`, `signOut`, and the existing protected admin route list.
- Produces: a compact 375px admin top bar and drawer, while preserving the fixed desktop `.admin-sidebar`.

- [ ] **Step 1: Add failing admin mobile assertions**

After fixture owner login in `tests/e2e/local-member-admin.spec.ts`, assert:

```ts
const trigger = ownerPage.getByRole('button', { name: '開啟選單' })
await expect(trigger).toBeVisible()
await trigger.click()
const menu = ownerPage.getByRole('dialog', { name: '商店後台導覽' })
await expect(menu.getByRole('link', { name: '訂單管理' })).toBeVisible()
await expect(menu.getByRole('link', { name: '商品管理與庫存' })).toBeVisible()
await expect(menu.getByRole('button', { name: '登出' })).toBeVisible()
await menu.getByRole('button', { name: '關閉選單' }).click()
await expect(trigger).toBeFocused()
await expect.poll(() => ownerPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
```

- [ ] **Step 2: Run the admin acceptance and verify RED**

Run:

```bash
PLAYWRIGHT_LOCAL_PORT=3110 pnpm exec playwright test \
  tests/e2e/local-member-admin.spec.ts --project=mobile
```

Expected: FAIL because the admin navigation is still a permanently expanded grid.

- [ ] **Step 3: Add the compact admin bar and drawer**

Keep the existing `.admin-sidebar` unchanged for desktop. Add this local helper and use it in both the desktop sidebar and mobile drawer:

```tsx
function AdminNavigationLinks() {
  return <>
    <Link href="/admin"><span>總</span>商店總覽</Link>
    <Link href="/admin/orders"><span>單</span>訂單管理</Link>
    <Link href="/admin/products"><span>品</span>商品管理與庫存</Link>
    <Link href="/admin/categories"><span>類</span>商品分類</Link>
    <Link href="/admin/members"><span>客</span>會員管理</Link>
    <Link href="/admin/marketing"><span>促</span>行銷推廣</Link>
    <Link href="/admin/reports"><span>報</span>報表分析</Link>
    <Link href="/admin/settings"><span>設</span>商店設定</Link>
    <Link href="/"><span>↗</span>返回商城</Link>
  </>
}
```

Add an `.admin-mobile-header` before the desktop sidebar containing:

```tsx
<Link aria-label="MORIMUR BABY 商店後台" className="admin-mobile-brand" href="/admin">
  <BrandLogo subtitle="store room" />
</Link>
<span>商店後台</span>
<MobileMenu ariaLabel="商店後台導覽" heading="商店管理" id="admin-mobile-menu">
  <div className="admin-mobile-owner"><strong>mori 老闆</strong><small>商店管理員</small></div>
  <nav className="admin-mobile-nav" aria-label="手機版商店後台導覽"><AdminNavigationLinks /></nav>
  <form action={signOut}><button type="submit">登出</button></form>
</MobileMenu>
```

Keep `AdminNavigationLinks` inside `src/app/admin/layout.tsx`; do not create a global navigation configuration abstraction.

- [ ] **Step 4: Add admin mobile CSS**

Within `@media (max-width: 36rem)` hide `.admin-sidebar`, display `.admin-mobile-header` as a sticky three-column row, keep `.admin-workspace { margin-left: 0; }`, and style drawer links as one-column touch targets. Above 36rem, hide `.admin-mobile-header` and retain all existing sidebar/tablet behavior.

- [ ] **Step 5: Run the admin acceptance and verify GREEN**

Run the focused admin Playwright command again. Also run:

```bash
pnpm exec vitest run tests/unit/mobile-menu.test.tsx tests/unit/brand-assets.test.ts
pnpm exec eslint src/app/admin/layout.tsx tests/e2e/local-member-admin.spec.ts
```

Expected: mobile admin drawer passes, desktop sidebar remains visible, and all focused checks exit 0.

- [ ] **Step 6: Commit the admin integration**

```bash
git add -p src/app/admin/layout.tsx src/app/globals.css tests/e2e/local-member-admin.spec.ts
git diff --cached --check
git commit -m "feat: add admin mobile navigation"
```

---

### Task 5: Complete Cross-Surface Verification

**Files:**
- Modify only if a verification failure reveals a task-owned issue.

**Interfaces:**
- Consumes: completed brand assets, shared drawer, storefront integration, and admin integration.
- Produces: evidence that the current dirty worktree and committed task range are both usable.

- [ ] **Step 1: Verify the exact task diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; unrelated pre-existing dirty files remain present and unmodified by cleanup commands.

- [ ] **Step 2: Run static checks**

```bash
pnpm run lint
pnpm exec tsc --noEmit
```

Expected: both exit 0.

- [ ] **Step 3: Run all unit and integration tests**

```bash
pnpm exec vitest run
```

Expected: all test files pass with 0 failures.

- [ ] **Step 4: Run the production build**

```bash
pnpm run build
```

Expected: Next.js compiles successfully, completes TypeScript checking, and includes the icon route.

- [ ] **Step 5: Run the complete local browser suite**

Use an isolated local port and fixture mode:

```bash
PLAYWRIGHT_LOCAL_PORT=3110 \
PLAYWRIGHT_DEV_COMMAND='pnpm dev --webpack --hostname 127.0.0.1 --port 3110' \
pnpm exec playwright test
```

Expected: all local desktop/mobile tests pass; live Supabase tests remain skipped without explicit live credentials.

- [ ] **Step 6: Manually inspect the four handoff surfaces**

At 375 × 812 inspect `/`, `/products`, `/admin`, and `/admin/orders`. Confirm the circular badge is crisp, the drawer does not cover its own close control, the page has no horizontal overflow, and focus returns to the trigger after Escape. At desktop width confirm the full storefront navigation and fixed admin sidebar remain visible.

- [ ] **Step 7: Commit any verification-only test adjustment**

If no adjustment was needed, do not create an empty commit. If a task-owned regression test needed correction, stage only the named acceptance files that changed:

```bash
git add tests/e2e/mobile.spec.ts tests/e2e/accessibility.spec.ts \
  tests/e2e/local-member-admin.spec.ts
git diff --cached --check
git commit -m "test: verify mobile navigation and branding"
```
