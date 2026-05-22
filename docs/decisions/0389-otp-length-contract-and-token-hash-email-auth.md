---
title: OTP length contract + token_hash email auth
status: accepted
updated: 2026-05-22
created: 2026-05-22
module: auth
tags: [auth, otp, email-templates, token_hash, gotrue, supabase]
---

# ADR-0389 — OTP length contract + token_hash email auth

## Status

Accepted (2026-05-22).

## Context

A multi-day prod auth outage on `app.smartout.ai` (login via code, magic link,
and password reset all failing) was diagnosed to **three distinct root causes**,
none of which was the originally-suspected "email link scanner":

1. **verifyOtp type mismatch.** Password reset minted a `recovery` token but the
   code was verified with `type:"email"`. GoTrue answers `403 otp_expired` for
   "no matching token of THIS type" — a misleading generic, not a time expiry.
   (A live, unconsumed recovery token sat in `auth.one_time_tokens` 26 min after
   issue while verify returned 403.)

2. **Fragile PKCE email links.** `emailRedirectTo`/`redirectTo` minted a magic
   link that hit `/api/auth/callback?code=` (PKCE), which needs the
   `code_verifier` cookie from the *originating* browser. Stale/rotated tokens
   and cross-context clicks → "One-time token not found" → bounce to `/login`.
   The AWS IPs in the auth logs were **Vercel SSR egress**, not a mail scanner.

3. **OTP length mismatch (the final, silent one).** GoTrue prod dashboard had
   `OTP Length = 8`, but `OtpVerificationForm` rendered **6** input boxes. The
   user could only type 6 of the 8 digits → truncated code → `403 otp_expired`
   on a perfectly valid code. Proven by `POST /auth/v1/verify` with the full
   8-digit code + `type:email` returning `200` while the 6-box form failed.

## Decision

### 3.1 Email auth uses `token_hash`, server-side verified

`/api/auth/callback` accepts `token_hash` + `type` and calls `verifyOtp`
SERVER-SIDE (no PKCE `code_verifier` cookie → works across email clients and
devices). PKCE `?code=` remains only for OAuth (Google). Email templates link to
`{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=<T>&next=<P>`.
A forged `?type` is rejected via an `ALLOWED_OTP_TYPES` allow-list.

### 3.2 verifyOtp type tracks the issuing flow

`OtpVerificationForm` picks the verify type by context via `VERIFY_TYPE`
(`login`/`workspace_entry` → `email`, `recovery` → `recovery`). Reset is a
link-send flow; login is code-first.

### 3.3 One mechanism per email — code OR link, never both

A 6-digit `{{ .Token }}` code and a `{{ .TokenHash }}` magic link in the SAME
email share ONE GoTrue one-time token. A mail-client/scanner prefetch of the
link, or simply using one, consumes the token and the other dies. Therefore the
**OTP login email is code-only**; the reset email is link-only (separate email,
separate token).

### 3.4 OTP LENGTH CONTRACT (the load-bearing invariant)

> GoTrue `otp_length` MUST equal `OTP_LENGTH` in
> `apps/web/src/components/auth/OtpVerificationForm.tsx`, and BOTH must be **6**.

- **Local:** `supabase/config.toml` → `[auth.email] otp_length = 6`.
- **Prod:** Supabase dashboard → Authentication → Email → **OTP Length = 6**.
- **Code:** `const OTP_LENGTH = 6` drives every digit-count in the form.

The login code field renders exactly `OTP_LENGTH` boxes. If GoTrue mints a
longer code, the user physically cannot enter it → `403` on a valid code, with
no error that points at the cause.

## Enforcement

- `scripts/check-otp-coherence.mjs` asserts `config.toml otp_length` ===
  `OtpVerificationForm OTP_LENGTH`; runs in **husky pre-push** (blocks the push
  on drift) and is exposed as `pnpm check:otp`.
- Loud warning comments in `config.toml`, `OtpVerificationForm.tsx`, and the
  pre-push hook, all citing this ADR.
- **Prod dashboard cannot be code-enforced** (no Management API token in CI).
  It is enforced by this ADR + the config.toml warning. **Do not change the prod
  OTP Length from 6.** If it must change, change `OTP_LENGTH` + `config.toml` +
  this ADR in the same PR.

## Consequences

- OTP login, magic-link reset, and Google all work cross-device.
- Magic-link **login** from the OTP email is intentionally dropped (§3.3) — the
  code-first screen is the login surface; reset keeps its own link email.
- A future drift-check could query prod GoTrue `otp_length` via the Management
  API to close the prod-dashboard gap; not built (no token in CI).

## Refs

- ADR-0374 (portal auth redirect), ADR-0375 (root-domain assert), ADR-0021.
- `supabase/email-templates/` (6 redesigned templates), `supabase/email-templates/README.md`.
- Prod project `yljaglomadbhyqpcigff`; outage window 2026-05-21 → 2026-05-22.
