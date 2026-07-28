# Email OTP Member Registration Design

**Date:** 2026-07-28
**Status:** Approved direction, awaiting written-spec review

## Goal

Replace the current one-step member signup with a three-step registration flow that verifies the customer's Email using a six-digit one-time code. A Taiwan mobile number remains required as member contact information, but no SMS is sent.

Existing Email-and-password login remains unchanged after registration.

## User Flow

### Step 1: Contact and consent

The signup page asks for:

- Email address
- Taiwan mobile number in `09xxxxxxxx` format
- One required checkbox confirming acceptance of the Terms of Service and Privacy Policy

The `下一步` button remains disabled until the fields are valid and the required consent is checked. Submitting the step requests an Email OTP.

Marketing consent is not included. It must remain separate and optional if added later.

### Step 2: Email verification

The page shows:

- A six-digit OTP input
- A masked destination such as `mo***@gmail.com`
- A `驗證 Email` action
- A resend action disabled for 60 seconds
- A way to return and change the Email address

The page handles invalid, expired, rate-limited, and temporarily unavailable verification requests with clear Traditional Chinese messages. It must not reveal whether an Email address already belongs to an account before verification.

### Step 3: Password setup

After OTP verification, the customer sets a password with a minimum length of eight characters. Successful completion stores the verified member profile and takes the customer to the account area. Existing safe `next` destinations remain supported.

## Authentication Architecture

### Production

Supabase Auth remains the source of truth for identity and sessions.

1. Request an Email OTP through Supabase Auth.
2. Verify the six-digit token using Supabase Auth.
3. After verification, set the member password.
4. Persist the Taiwan mobile number and consent timestamp in the member profile.

The Supabase Email template must display the OTP token rather than requiring a magic-link-only flow. Production delivery uses a custom SMTP provider. Resend is the initial recommended provider, but SMTP credentials are deployment configuration and are not required for the local demo.

OTP request and verification actions run on the server. The browser never receives SMTP credentials or Supabase secret keys.

### Local fixture mode

Local fixture mode uses the fixed OTP `123456` and does not send Email. It must reproduce the same three steps, validation, expiry/resend state, profile creation, and final login behavior without incurring provider charges.

The fixed code is limited to fixture mode and must never be enabled by production configuration.

## Data Model

The member profile stores:

- `phone`: normalized Taiwan mobile number
- `terms_accepted_at`: server-generated acceptance timestamp

The Email remains owned by Supabase Auth. The phone number is not an authentication identifier and is not considered verified because no SMS verification occurs.

Existing profile creation and repair migrations must remain idempotent. Existing members may have no phone or consent timestamp, so new database columns must initially allow null values; new registrations require both through application validation.

The local fixture user representation stores the same phone and consent fields so owner/member screens behave consistently with production.

## Components and Boundaries

- `AuthForm` continues to own sign-in behavior and routes sign-up rendering to the registration flow.
- A focused signup component owns the three-step client experience and accessible focus movement.
- Server actions own OTP request, OTP verification, password setup, normalization, throttling responses, and safe redirects.
- Auth repositories own provider-specific Supabase and fixture behavior.
- Profile queries expose the stored phone to member and owner views without changing order recipient phone data.

No social login, SMS login, marketing subscription, or passwordless recurring login is part of this change.

## Validation and Safety

- Email must pass the existing Email validation rules.
- Phone must match `^09\d{8}$` after trimming common spaces and hyphens.
- Consent must be explicitly checked on the request that starts registration.
- OTP must contain exactly six digits.
- Password must contain at least eight characters.
- Resend is unavailable for 60 seconds after a successful request.
- Provider error messages are mapped to safe customer-facing copy.
- Requests retain Supabase rate limiting; production setup should also enable CAPTCHA before public launch.
- Password, OTP, SMTP credentials, and service secret keys are never logged or persisted in plain text.

## Accessibility and Responsive Layout

The signup flow uses the existing mori authentication shell and mobile-first styling.

- Every field has a persistent label and associated error message.
- Step changes move focus to the new step heading or first invalid field.
- Status updates use an appropriate live region.
- OTP inputs support numeric mobile keyboards and pasting the full six-digit code.
- Buttons retain at least a 44px touch target.
- Terms and Privacy links remain keyboard accessible without toggling the checkbox accidentally.

## Verification Strategy

### Unit and integration tests

- Step 1 requires valid Email, valid phone, and required consent.
- OTP request enters Step 2 and masks the Email correctly.
- Wrong and expired OTPs remain on Step 2 with accessible errors.
- Resend observes the countdown and invokes only one provider request per action.
- Correct OTP enters Step 3.
- Password validation prevents completion below eight characters.
- Completed fixture registration stores Email, phone, and consent timestamp.
- Existing duplicate-account and safe redirect behavior remains covered.
- Sign-in remains Email and password based.

### Browser tests

- Complete the three-step flow at desktop and 375px mobile widths using fixture OTP `123456`.
- Confirm keyboard focus, no horizontal overflow, required checkbox behavior, and responsive controls.
- Sign in using the newly created Email and password.
- Confirm the owner member view displays the saved phone number.

## Rollout and Cost Boundary

Local development has no Email delivery cost. Production Email OTP delivery is enabled only after a custom SMTP account and verified sending domain are configured. The initial free SMTP allowance can cover early usage, but provider quotas and current pricing must be reviewed at deployment time.

If production SMTP is not configured, the application must fail with a clear operational message rather than pretending that an OTP was sent.
