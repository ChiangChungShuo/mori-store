# Email OTP Member Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a three-step member signup that collects Email and a Taiwan mobile number, requires legal consent, verifies a six-digit Email OTP, and then sets the member password.

**Architecture:** Keep the existing Email-and-password sign-in unchanged. Add focused signup contracts, server actions, and UI; Supabase owns production OTP/session behavior while the existing in-memory fixture repository simulates the same flow with code `123456`. Store phone and consent time in `profiles`, then expose phone in the member and owner views.

**Tech Stack:** Next.js 16 Server Actions, React 19, TypeScript, Zod 4, Supabase Auth/Postgres, Vitest, Testing Library, Playwright.

## Global Constraints

- Email receives the OTP; the phone number is contact data only and is not verified.
- New registrations require a Taiwan mobile matching `09xxxxxxxx` after removing spaces and hyphens.
- Legal consent is mandatory and stores a server-generated `terms_accepted_at` timestamp.
- OTP is exactly six digits; local fixture OTP is exactly `123456` and is unavailable outside fixture mode.
- OTP resend remains disabled for 60 seconds after a successful request.
- Password remains at least eight characters and future login remains Email plus password.
- Existing members remain valid; new profile columns are nullable for migration compatibility.
- Do not add SMS, social login, marketing consent, or recurring passwordless login.
- Never expose or log OTPs, passwords, Supabase secret keys, or SMTP credentials.
- Preserve the existing dirty worktree and stage only files belonging to each task.

---

## File Structure

- `src/features/auth/signup-contract.ts`: signup schemas, normalization, masking, and action-state types.
- `src/features/auth/signup-actions.ts`: production/fixture server actions for request, verify, and password completion.
- `src/features/auth/signup-form.tsx`: the accessible three-step client registration experience.
- `src/features/auth/auth-form.tsx`: remains responsible for sign-in and links to signup.
- `src/testing/e2e-auth-repository.ts`: fixture pending OTP and verified signup behavior.
- `src/testing/e2e-store.ts`: fixture user contact fields and pending signup storage.
- `supabase/migrations/202607280001_profile_contact_consent.sql`: forward-only profile/contact migration and trigger repair.
- `supabase/_full-setup.sql`: fresh-install equivalent of the new migration.
- `src/types/database.ts`: generated-shape-compatible profile fields.
- `src/features/account/summary.ts`, `src/app/account/page.tsx`: member phone display.
- `src/features/admin/business-management.ts`, `src/app/admin/members/page.tsx`: owner member-phone display.
- `tests/unit/signup-contract.test.ts`, `tests/unit/signup-form.test.tsx`: validation and UI state tests.
- `tests/integration/signup-actions.test.ts`, `tests/integration/profile-contact-migration.test.ts`: action/repository and SQL contracts.
- `tests/e2e/local-member-admin.spec.ts`, `tests/e2e/accessibility.spec.ts`: complete mobile/desktop signup and accessibility flow.

---

### Task 1: Signup validation and state contracts

**Files:**
- Create: `src/features/auth/signup-contract.ts`
- Create: `tests/unit/signup-contract.test.ts`

**Interfaces:**
- Produces: `normalizeTaiwanMobile(value: string): string`
- Produces: `maskEmail(email: string): string`
- Produces: `signupContactSchema`, `signupOtpSchema`, `signupPasswordSchema`
- Produces: `SignupContactState`, `SignupOtpState`, `SignupPasswordState`

- [ ] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  maskEmail,
  normalizeTaiwanMobile,
  signupContactSchema,
  signupOtpSchema,
  signupPasswordSchema,
} from '@/features/auth/signup-contract'

describe('signup contract', () => {
  it('normalizes Taiwan mobile separators and rejects non-mobile numbers', () => {
    expect(normalizeTaiwanMobile('0912-345-678')).toBe('0912345678')
    expect(signupContactSchema.safeParse({
      email: 'parent@example.com', phone: '02-1234-5678', consent: 'on',
    }).success).toBe(false)
  })

  it('requires legal consent and a valid Email', () => {
    expect(signupContactSchema.safeParse({
      email: 'parent@example.com', phone: '0912345678', consent: undefined,
    }).success).toBe(false)
  })

  it('accepts exactly six OTP digits and an eight-character password', () => {
    expect(signupOtpSchema.safeParse({ email: 'parent@example.com', token: '123456' }).success).toBe(true)
    expect(signupOtpSchema.safeParse({ email: 'parent@example.com', token: '12345' }).success).toBe(false)
    expect(signupPasswordSchema.safeParse({ password: 'parent12' }).success).toBe(true)
    expect(signupPasswordSchema.safeParse({ password: 'short' }).success).toBe(false)
  })

  it('masks the destination without hiding the domain', () => {
    expect(maskEmail('mori.parent@example.com')).toBe('mo***@example.com')
  })
})
```

- [ ] **Step 2: Run the tests and confirm the missing-module failure**

Run: `pnpm exec vitest run tests/unit/signup-contract.test.ts`

Expected: FAIL because `@/features/auth/signup-contract` does not exist.

- [ ] **Step 3: Implement the schemas and action-state types**

```ts
import { z } from 'zod'

export function normalizeTaiwanMobile(value: string) {
  return value.trim().replace(/[\s-]/g, '')
}

export function maskEmail(email: string) {
  const [local, domain = ''] = email.toLowerCase().split('@')
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`
}

export const signupContactSchema = z.object({
  email: z.string().trim().toLowerCase().email('請輸入有效的 Email'),
  phone: z.string().transform(normalizeTaiwanMobile)
    .pipe(z.string().regex(/^09\d{8}$/, '請輸入有效的台灣手機號碼')),
  consent: z.literal('on', { error: '請先同意服務條款與隱私權政策' }),
})

export const signupOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().trim().regex(/^\d{6}$/, '請輸入 6 位數驗證碼'),
})

export const signupPasswordSchema = z.object({
  password: z.string().min(8, '密碼至少需要 8 個字元'),
})

export type SignupContactState = {
  ok: boolean
  email?: string
  phone?: string
  maskedEmail?: string
  resendAvailableAt?: number
  fieldErrors?: { email?: string[]; phone?: string[]; consent?: string[] }
  message?: string
}

export type SignupOtpState = {
  ok: boolean
  verified?: boolean
  fieldErrors?: { token?: string[] }
  message?: string
}

export type SignupPasswordState = {
  ok: boolean
  fieldErrors?: { password?: string[] }
  message?: string
}
```

- [ ] **Step 4: Run the focused tests**

Run: `pnpm exec vitest run tests/unit/signup-contract.test.ts`

Expected: 4 tests PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add src/features/auth/signup-contract.ts tests/unit/signup-contract.test.ts
git commit -m "feat: define Email OTP signup contract"
```

---

### Task 2: Profile phone and consent persistence

**Files:**
- Create: `supabase/migrations/202607280001_profile_contact_consent.sql`
- Modify: `supabase/_full-setup.sql`
- Modify: `src/types/database.ts`
- Create: `tests/integration/profile-contact-migration.test.ts`

**Interfaces:**
- Produces: nullable `profiles.phone: string | null`
- Produces: nullable `profiles.terms_accepted_at: string | null`
- Consumes auth metadata keys: `phone`, `terms_accepted_at`

- [ ] **Step 1: Write the failing SQL integrity test**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadModule, parseSync } from 'pgsql-parser'

const migration = readFileSync(resolve(
  process.cwd(), 'supabase/migrations/202607280001_profile_contact_consent.sql',
), 'utf8')

beforeAll(async () => loadModule())

describe('profile contact migration', () => {
  it('parses and adds nullable contact fields idempotently', () => {
    expect(() => parseSync(migration)).not.toThrow()
    expect(migration).toMatch(/add column if not exists phone text/i)
    expect(migration).toMatch(/add column if not exists terms_accepted_at timestamptz/i)
  })

  it('copies server-provided auth metadata and protects consent', () => {
    expect(migration).toMatch(/raw_user_meta_data ->> 'phone'/i)
    expect(migration).toMatch(/raw_user_meta_data ->> 'terms_accepted_at'/i)
    expect(migration).toMatch(/new\.terms_accepted_at is distinct from old\.terms_accepted_at/i)
  })
})
```

- [ ] **Step 2: Run the test and confirm the missing-file failure**

Run: `pnpm exec vitest run tests/integration/profile-contact-migration.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Add the forward-only migration**

```sql
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

alter table public.profiles drop constraint if exists profiles_phone_format;
alter table public.profiles add constraint profiles_phone_format
check (phone is null or phone ~ '^09[0-9]{8}$');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role, phone, terms_accepted_at)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    'customer',
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz
  )
  on conflict (id) do update set
    phone = coalesce(public.profiles.phone, excluded.phone),
    terms_accepted_at = coalesce(public.profiles.terms_accepted_at, excluded.terms_accepted_at);
  return new;
end;
$$;
```

In the same migration, replace `public.protect_member_profile()` so non-admin authenticated users cannot change `phone` or `terms_accepted_at`. Drop and recreate `on_auth_user_created` defensively, then revoke direct execution using the existing migration pattern.

- [ ] **Step 4: Update fresh setup and TypeScript database shapes**

Add nullable `phone` and `terms_accepted_at` fields to `profiles` Row/Insert/Update in `src/types/database.ts`. Apply the same table columns, constraint, trigger function, and protection rules to `supabase/_full-setup.sql` so fresh and upgraded installs match.

- [ ] **Step 5: Run migration and schema tests**

Run: `pnpm exec vitest run tests/integration/profile-contact-migration.test.ts tests/unit/store-schema.test.ts tests/unit/final-migration-integrity.test.ts`

Expected: all selected tests PASS.

- [ ] **Step 6: Commit profile persistence**

```bash
git add supabase/migrations/202607280001_profile_contact_consent.sql supabase/_full-setup.sql src/types/database.ts tests/integration/profile-contact-migration.test.ts
git commit -m "feat: persist member phone and consent"
```

---

### Task 3: Fixture OTP repository

**Files:**
- Modify: `src/testing/e2e-store.ts`
- Modify: `src/testing/e2e-auth-repository.ts`
- Modify: `tests/integration/fixture-auth.test.ts`

**Interfaces:**
- Produces: `requestSignupOtpE2E(email, phone, termsAcceptedAt): Promise<'sent' | 'duplicate'>`
- Produces: `verifySignupOtpE2E(email, token): Promise<'verified' | 'invalid' | 'expired'>`
- Produces: `completeSignupE2E(email, password): Promise<AuthenticatedUser | null>`
- Produces fixture user fields: `phone: string | null`, `termsAcceptedAt: string | null`

- [ ] **Step 1: Add failing fixture repository tests**

```ts
it('verifies fixture OTP before creating a password member with contact data', async () => {
  const email = `otp-${crypto.randomUUID()}@example.com`
  const acceptedAt = new Date().toISOString()

  await expect(requestSignupOtpE2E(email, '0912345678', acceptedAt)).resolves.toBe('sent')
  await expect(verifySignupOtpE2E(email, '000000')).resolves.toBe('invalid')
  await expect(verifySignupOtpE2E(email, '123456')).resolves.toBe('verified')
  const user = await completeSignupE2E(email, 'parent123')

  expect(user?.email).toBe(email)
  expect(getE2EStore().users.get(user!.id)).toMatchObject({
    phone: '0912345678', termsAcceptedAt: acceptedAt,
  })
})
```

Also test that completion before verification returns `null`, duplicate Email returns `duplicate`, and a pending code older than ten minutes returns `expired`.

- [ ] **Step 2: Run the fixture tests and confirm missing exports**

Run: `pnpm exec vitest run tests/integration/fixture-auth.test.ts`

Expected: FAIL because the three OTP repository functions are not exported.

- [ ] **Step 3: Add pending signup state**

```ts
export type E2EPendingSignup = {
  email: string
  phone: string
  termsAcceptedAt: string
  code: '123456'
  requestedAt: string
  verifiedAt: string | null
}

// Add this property to the existing E2EStoreState definition:
pendingSignups: Map<string, E2EPendingSignup>
```

Initialize `pendingSignups` with a new empty Map whenever the fixture store resets. Extend `E2EUser` with nullable `phone` and `termsAcceptedAt`; give the seeded admin null values.

- [ ] **Step 4: Implement the repository methods**

Normalize Email before every lookup. Store only `123456` in fixture mode, enforce a ten-minute age during verification, mark `verifiedAt`, then use the existing scrypt password hashing and session-cookie logic during completion. Delete the pending record after successful completion. Keep the existing direct `signUpE2E` helper for current tests and seed utilities.

- [ ] **Step 5: Run fixture auth coverage**

Run: `pnpm exec vitest run tests/integration/fixture-auth.test.ts tests/unit/e2e-store.test.ts`

Expected: all selected tests PASS.

- [ ] **Step 6: Commit the fixture OTP flow**

```bash
git add src/testing/e2e-store.ts src/testing/e2e-auth-repository.ts tests/integration/fixture-auth.test.ts tests/unit/e2e-store.test.ts
git commit -m "feat: simulate Email OTP registration locally"
```

---

### Task 4: Signup server actions

**Files:**
- Create: `src/features/auth/signup-actions.ts`
- Create: `tests/integration/signup-actions.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes Task 1 schemas and Task 3 fixture functions.
- Produces: `requestSignupOtp(formData: FormData): Promise<SignupContactState>`
- Produces: `verifySignupOtp(formData: FormData): Promise<SignupOtpState>`
- Produces: `completeSignup(formData: FormData): Promise<SignupPasswordState>`

- [ ] **Step 1: Write failing server-action tests**

Mock `next/headers`, `next/navigation`, the Supabase server client, and fixture-mode selection using the existing `tests/integration/fixture-auth.test.ts` conventions. Cover:

```ts
it('requires contact fields and consent before requesting OTP', async () => {
  const result = await requestSignupOtp(new FormData())
  expect(result.fieldErrors).toMatchObject({ email: expect.any(Array), phone: expect.any(Array), consent: expect.any(Array) })
})

it('sends fixture OTP and returns the masked destination', async () => {
  enableFixtureMode()
  const form = new FormData()
  form.set('email', 'Parent@Example.com')
  form.set('phone', '0912-345-678')
  form.set('consent', 'on')
  await expect(requestSignupOtp(form)).resolves.toMatchObject({
    ok: true, email: 'parent@example.com', phone: '0912345678', maskedEmail: 'pa***@example.com',
  })
})
```

Also cover incorrect fixture token, correct token, password shorter than eight characters, safe `next`, and successful redirect to `/account`.

- [ ] **Step 2: Run tests and confirm the missing-module failure**

Run: `pnpm exec vitest run tests/integration/signup-actions.test.ts`

Expected: FAIL because `signup-actions.ts` does not exist.

- [ ] **Step 3: Implement OTP request**

After schema validation, create `termsAcceptedAt = new Date().toISOString()`. Fixture mode calls `requestSignupOtpE2E`. Production calls:

```ts
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: true,
    data: { phone, terms_accepted_at: termsAcceptedAt },
  },
})
```

Return the same generic message for provider and duplicate-account conditions. On success return normalized contact values, masked Email, and `resendAvailableAt: Date.now() + 60_000`.

- [ ] **Step 4: Implement OTP verification and password completion**

Production verification uses:

```ts
await supabase.auth.verifyOtp({ email, token, type: 'email' })
```

Fixture verification uses `verifySignupOtpE2E`. Password completion validates the password and safe `next` path. Fixture mode calls `completeSignupE2E`; production requires `supabase.auth.getUser()` and calls `supabase.auth.updateUser({ password })`. Redirect to the safe `next` path or `/account` only after successful password update.

Map invalid/expired OTP to `驗證碼錯誤或已過期，請重新確認。`; map delivery problems to `目前無法寄出驗證碼，請稍後再試。` Do not return raw provider errors.

- [ ] **Step 5: Document production SMTP variables**

Add comments to `.env.example` explaining that Supabase Dashboard custom SMTP must be configured for real customer delivery and that fixture OTP never uses SMTP. Do not add real credentials or a production fixed OTP variable.

- [ ] **Step 6: Run action tests and type checking**

Run: `pnpm exec vitest run tests/integration/signup-actions.test.ts tests/unit/auth-actions.test.ts && pnpm exec tsc --noEmit --incremental false`

Expected: all selected tests PASS and TypeScript exits 0.

- [ ] **Step 7: Commit signup actions**

```bash
git add src/features/auth/signup-actions.ts tests/integration/signup-actions.test.ts .env.example
git commit -m "feat: add Email OTP signup actions"
```

---

### Task 5: Three-step signup interface

**Files:**
- Create: `src/features/auth/signup-form.tsx`
- Modify: `src/app/(auth)/signup/page.tsx`
- Modify: `src/features/auth/auth-form.tsx`
- Modify: `src/app/globals.css`
- Create: `tests/unit/signup-form.test.tsx`
- Modify: `tests/unit/auth-form.test.tsx`

**Interfaces:**
- Consumes Task 4 server actions.
- Produces: `SignupForm({ nextPath, fixtureMode }: { nextPath?: string; fixtureMode?: boolean })`
- Preserves: `AuthForm` sign-in behavior and login/signup navigation.

- [ ] **Step 1: Write failing registration UI tests**

Mock the three signup actions. Test that Step 1 exposes `Email`, `手機號碼`, the required legal checkbox, and a disabled `下一步` until client-valid inputs and consent exist. Then test:

```ts
expect(screen.getByRole('link', { name: '服務條款' })).toHaveAttribute('href', '/terms')
expect(screen.getByRole('link', { name: '隱私權政策' })).toHaveAttribute('href', '/privacy')
```

After a successful request state, assert the OTP step contains `驗證碼`, masked Email, `重新寄送`, and `修改 Email`. After successful verification, assert the password step contains `設定密碼` and the fixture hint `本機驗證碼：123456` appears only when `fixtureMode` is true.

- [ ] **Step 2: Run the UI tests and confirm the missing-component failure**

Run: `pnpm exec vitest run tests/unit/signup-form.test.tsx tests/unit/auth-form.test.tsx`

Expected: FAIL because `SignupForm` does not exist and the old signup UI still includes the password on Step 1.

- [ ] **Step 3: Implement the staged component**

Use a local discriminated stage state: `'contact' | 'verify' | 'password'`. Use one semantic `<form>` per stage and the corresponding Server Action through `useActionState`. Preserve normalized Email/phone in hidden inputs, preserve `next`, and focus the new step heading after transitions.

The OTP field uses:

```tsx
<input
  autoComplete="one-time-code"
  inputMode="numeric"
  maxLength={6}
  name="token"
  pattern="[0-9]{6}"
  aria-label="Email 驗證碼"
/>
```

Implement a client countdown based on `resendAvailableAt`; disable resend until zero and render `重新寄送（59 秒）`. Pasting a six-digit code must work without separate per-digit boxes.

- [ ] **Step 4: Route signup to the new component and keep sign-in focused**

Render `SignupForm` from `src/app/(auth)/signup/page.tsx`. Remove sign-up-specific password/consent branches from `AuthForm`, but retain all sign-in functionality, forgot-password link, notices, safe navigation, and fixture owner guidance.

- [ ] **Step 5: Add responsive and accessible styling**

Reuse `.auth-shell`, `.auth-card`, `.auth-field`, and existing button tokens. Add focused classes for step progress, consent row, OTP actions, and fixture hint. Keep every interactive target at least 44px, keep the form first in DOM order, and verify no horizontal overflow at 375px.

- [ ] **Step 6: Run focused UI and accessibility unit tests**

Run: `pnpm exec vitest run tests/unit/signup-form.test.tsx tests/unit/auth-form.test.tsx`

Expected: all selected tests PASS.

- [ ] **Step 7: Commit the signup interface**

```bash
git add src/features/auth/signup-form.tsx src/app/'(auth)'/signup/page.tsx src/features/auth/auth-form.tsx src/app/globals.css tests/unit/signup-form.test.tsx tests/unit/auth-form.test.tsx
git commit -m "feat: build three-step member signup"
```

---

### Task 6: Display member phone to customer and owner

**Files:**
- Modify: `src/features/account/summary.ts`
- Modify: `src/app/account/page.tsx`
- Modify: `src/features/admin/business-management.ts`
- Modify: `src/app/admin/members/page.tsx`
- Modify: `tests/integration/admin-business-management.test.ts`
- Modify: `tests/integration/fixture-auth.test.ts`

**Interfaces:**
- Extends `MemberRecord` with `phone: string | null` and `termsAcceptedAt: string | null`.
- Extends account summary result with `phone: string | null`.

- [ ] **Step 1: Write failing member display tests**

Register a fixture user through the OTP repository, then assert `listMembers()` returns:

```ts
expect(member).toMatchObject({
  email,
  phone: '0912345678',
  accountType: '會員',
})
expect(member.termsAcceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
```

Add source/render assertions that the account page labels `手機號碼` and the admin member card renders the phone without exposing the consent timestamp as customer-facing copy.

- [ ] **Step 2: Run the focused tests and confirm missing phone fields**

Run: `pnpm exec vitest run tests/integration/admin-business-management.test.ts tests/integration/fixture-auth.test.ts`

Expected: FAIL because member records and account summaries do not expose phone.

- [ ] **Step 3: Extend account summary**

Fixture mode reads phone from the authenticated fixture user. Production selects `display_name, phone` from the current user's profile. Return `phone` and show it under `基本資料`; render `尚未提供` only for migrated members with null phone.

- [ ] **Step 4: Extend owner member listing**

Fixture mode reads phone and consent from `E2EUser`. Production requires admin first, then uses the server-only admin client to list Auth users and the authenticated Supabase client to select `profiles(id, phone, terms_accepted_at)` plus orders. Merge by profile/user ID and Email so registered members without orders appear alongside guest buyers. Do not send the secret key to the client.

- [ ] **Step 5: Render owner contact information**

In each admin member card, display the saved phone next to Email for members. Guest buyers without a member profile render `未註冊會員手機`. Keep existing tier, points, discount, and order details unchanged.

- [ ] **Step 6: Run focused tests**

Run: `pnpm exec vitest run tests/integration/admin-business-management.test.ts tests/integration/fixture-auth.test.ts`

Expected: all selected tests PASS.

- [ ] **Step 7: Commit member contact display**

```bash
git add src/features/account/summary.ts src/app/account/page.tsx src/features/admin/business-management.ts src/app/admin/members/page.tsx tests/integration/admin-business-management.test.ts tests/integration/fixture-auth.test.ts
git commit -m "feat: show registered member phone"
```

---

### Task 7: Browser flow, production guidance, and final verification

**Files:**
- Modify: `tests/e2e/local-member-admin.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`
- Create: `docs/email-otp-setup.md`

**Interfaces:**
- Consumes the complete registration flow from Tasks 1–6.
- Produces deployment instructions for Supabase Email template and custom SMTP.

- [ ] **Step 1: Update the failing end-to-end registration flow**

Replace the old one-step signup in `tests/e2e/local-member-admin.spec.ts` with:

```ts
await page.goto('/signup')
await page.getByLabel('Email').fill(email)
await page.getByLabel('手機號碼').fill('0912345678')
await page.getByLabel(/我已閱讀並同意/).check()
await page.getByRole('button', { name: '下一步' }).click()
await page.getByLabel('Email 驗證碼').fill('123456')
await page.getByRole('button', { name: '驗證 Email' }).click()
await page.getByLabel('設定密碼').fill('parent123')
await page.getByRole('button', { name: '完成註冊' }).click()
await expect(page).toHaveURL(/\/account/)
```

Then sign out, sign back in with Email and password, and verify the owner member page displays `0912345678`.

- [ ] **Step 2: Add responsive and accessibility checks**

At 375px assert no horizontal overflow, all three steps have a visible heading, validation errors are associated through `aria-describedby`, OTP uses `inputmode="numeric"`, and checkbox/links are keyboard reachable. Keep the existing axe-equivalent accessibility assertions used by the project.

- [ ] **Step 3: Run tests and confirm the old flow fails**

Run: `pnpm exec playwright test tests/e2e/local-member-admin.spec.ts tests/e2e/accessibility.spec.ts --project=mobile`

Expected before completing Tasks 1–6: FAIL on the missing staged controls. Expected after Tasks 1–6: PASS.

- [ ] **Step 4: Write production setup instructions**

Document these exact operational steps in `docs/email-otp-setup.md`:

1. Create and verify the sending domain with the chosen SMTP provider.
2. Enter SMTP host, port, username, password, sender address, and sender name in Supabase Dashboard Authentication Email SMTP settings.
3. Change the signup Email template to show `{{ .Token }}` as a six-digit verification code.
4. Keep the 60-second per-address resend window and configure an appropriate project-wide Email rate limit.
5. Apply `supabase/migrations/202607280001_profile_contact_consent.sql` before enabling the new signup page.
6. Test delivery to Gmail and another provider, including spam-folder behavior.
7. Confirm fixture code `123456` is not present in production configuration.

- [ ] **Step 5: Run the complete verification suite**

Run:

```bash
pnpm run lint
pnpm exec tsc --noEmit --incremental false
pnpm exec vitest run
pnpm exec playwright test tests/e2e/local-member-admin.spec.ts tests/e2e/accessibility.spec.ts --project=mobile
VERCEL_ENV=preview pnpm run build
```

Expected: lint, TypeScript, focused browser tests, and build exit 0. If the pre-existing admin empty-order copy assertion remains the only full Vitest failure, report its exact file/line and do not describe the suite as fully passing.

- [ ] **Step 6: Verify the running local site**

Start fixture mode with:

```bash
MORI_E2E_FIXTURES=1 pnpm dev --hostname 0.0.0.0 --port 3000
```

Open `/signup` at desktop and 375px, complete the flow with `123456`, and capture the contact, OTP, and password steps under `output/email-otp-signup/`.

- [ ] **Step 7: Commit browser coverage and operations guide**

```bash
git add tests/e2e/local-member-admin.spec.ts tests/e2e/accessibility.spec.ts docs/email-otp-setup.md
git commit -m "test: verify Email OTP member registration"
```

---

## Completion Checklist

- Signup requires valid Email, Taiwan mobile, and legal consent.
- Email OTP works through fixture and Supabase provider boundaries.
- Fixed OTP is confined to fixture mode.
- Password is set only after successful OTP verification.
- Existing Email/password sign-in remains functional.
- Profile phone and consent timestamp persist for new members.
- Member and owner views show the saved phone.
- Mobile layout, focus behavior, resend state, safe redirects, and provider errors are covered.
- SMTP/template setup is documented without committing credentials.
