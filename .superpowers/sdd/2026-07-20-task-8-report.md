# Task 8 report — complete local member-to-owner flow

Base: `229640d`

## Provenance and RED

- `tests/e2e/local-member-admin.spec.ts` already contained an unstaged draft before Task 8. The draft covered registration, login, payment and an owner lookup, but it skipped the cart quantity assertion, the signed-in member order page and matching the exact order number across both sessions.
- I extended that acceptance test before changing application code, then ran it from an isolated repository copy on Node 22 and port 3108 so the existing port 3000 process was untouched.
- Effective RED: the newly paid order existed in `/account/orders`, but no link had the accessible name of its order number; the test failed at `getByRole('link', { name: orderNumber })`.
- Minimal GREEN: `/account/orders` now uses the real order number as the detail-link text. The same acceptance then passed on desktop and 375 px mobile.
- The first cold full-suite run exposed a second deterministic issue: the local in-memory fixture store was mutated by five Playwright workers concurrently, producing aborted navigations and cross-test order collisions. Local fixture runs now use one worker; external live targets keep Playwright's default worker behavior. A fresh cold full run then passed.

## Changes

- Verifies signup → login → product/size → cart quantity 2 → checkout → test payment → member order history → owner login → exact same admin order detail.
- Verifies customer `/admin` denial, owner navigation, filtering, seeded order detail and mobile overflow.
- Keeps the existing keyboard focus and 375 px viewport checks in the Task 8 acceptance set.
- Adds no-Supabase local demo setup and owner credentials to `README.md` and `docs/local-setup.md`, including the in-memory reset warning and production Supabase boundary.
- Fixes the repo-wide TypeScript blockers in fixture-auth and migration-integrity tests without changing runtime behavior.

## Verification (Node 22.23.1)

- `git diff --check` — pass
- `pnpm run lint` — pass
- `pnpm exec vitest run` — 27 files, 204 tests passed
- `pnpm exec tsc --noEmit` — pass
- `pnpm run build` — pass; all Next.js routes compiled and TypeScript completed
- Cold isolated `pnpm exec playwright test` — 24 passed, 16 live-Supabase tests skipped, 0 failed
- Focused complete acceptance — desktop and 375 px mobile, 2 passed

## Boundaries / concerns

- Fixture accounts and orders intentionally reset when the development server restarts.
- `MORI_E2E_FIXTURES=1` remains guarded by non-production mode; production continues to resolve Supabase repositories.
- Full browser verification used an isolated port 3108 and did not stop or replace the user's port 3000 server.

## Reviewer follow-up

- Added owner-detail assertions that bind the purchased 「有機棉小樹 T 恤」 row to quantity `2` and verify 商品小計 `NT$1,360`, 運費 `NT$60`, 訂單總計 `NT$1,420` inside the 訂購商品 section.
- The first assertion run failed because the nested Playwright `has` locator was scoped outside its candidate row; the failure snapshot confirmed that the persisted item, quantity and totals were already correct. The locator was reduced to the row accessible name plus exact cells and paired `dt`/`dd` assertions; no production change was required.
- Isolated Turbopack acceptance on Node 22 and port 3108: desktop and 375 px mobile, 2 passed.
- Focused ESLint, `tsc --noEmit` and `git diff --check`: pass.
