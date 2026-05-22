---
title: "Plan — mobile-reset-token-hash-bridge"
status: draft
updated: 2026-05-22
created: 2026-05-22
module: auth
tags: [plan, auth, mobile, reset-password, token_hash, adr-0368, adr-0389]
---

# Plan — Mobile password-reset lands natively (/m/ bridge), not web

> Branch: `feat/mobile-reset-token-hash-bridge` | Worktree: /home/sxtnl/dev/smartout.ai-wt-6 | Base: `development` | Module: auth | Started: 2026-05-22

## Problem

Web email auth uses robust `token_hash` server-side verify (ADR-0389): the
recovery email links to
`{{ .SiteURL }}/api/auth/callback?token_hash=…&type=recovery&next=/update-password`.

Mobile calls `resetPasswordForEmail(email, { redirectTo: "https://app.smartout.ai/m/update-password" })`
(ADR-0368 Universal-Link bridge). But there is ONE GoTrue "Reset Password"
template and it **hardcodes the web `next=/update-password`**, ignoring the
per-request `{{ .RedirectTo }}`. So a mobile reset link opens the **web**
`/update-password` in a browser, bypassing the native `/m/` flow. Works, but
not native.

## Goal

Mobile reset link → `/m/update-password` (Universal Link → app), verified via
`token_hash` server-side, WITHOUT breaking web reset, from ONE template.

## Constraints / facts

- ONE GoTrue "Reset Password" template serves web + mobile.
- `token_hash` verify is robust (no PKCE `code_verifier` cookie) — keep it.
- Web `next` is a relative path validated by `validateReturnTo` (rejects full URLs).
- ADR-0368 `/m/update-password` is a web bridge route; it does NOT yet verify a `token_hash`.
- OTP length contract (ADR-0389) is unaffected — reset-link routing only.

## Tasks

- [ ] **P0 Brainstorm/design** (superpowers:brainstorming) — pick the single-template
      strategy. Preferred: template builds the link from `{{ .RedirectTo }}` so each
      platform's destination is honored; both destinations verify token_hash. Append
      an ADR extending ADR-0368 + ADR-0389. Falsifiable: one template, both platforms
      land natively, web still works, no open-redirect regression.
- [ ] **P1 `/m/update-password` bridge** — server-side `verifyOtp({ token_hash, type:"recovery" })`
      → recovery session → relay into app (Universal Link/scheme) or render set-password.
      Verify locally with Inbucket.
- [ ] **P2 Template + redirectTo** — recovery template uses `{{ .RedirectTo }}`; web +
      mobile both pass explicit redirectTo. Re-apply template to prod (operator step).
- [ ] **P3 Verify** — web reset (token_hash → /update-password) still green; mobile reset
      (token_hash → /m/update-password → app) green; `pnpm check:otp` + `ci:local` pass.

## Open design questions (resolve in P0)

- One template encoding two destinations vs keying entirely off `{{ .RedirectTo }}`?
- Does `/m/update-password` set the session itself or relay token_hash into the app?
- Keep `validateReturnTo` open-redirect guard for web `next`.

## Out of scope

- OTP code login (correct + enforced, ADR-0389).
- Magic-link login (intentionally dropped from OTP email, ADR-0389).
- Web reset (working).

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] `pnpm check:otp` passes (OTP length contract intact)
- [ ] Web reset still lands on /update-password with a live recovery session
- [ ] Mobile reset lands on /m/update-password (native), token_hash verified
- [ ] No open-redirect regression in callback / bridge
- [ ] Decision log updated (ADR extending 0368 + 0389)
- [ ] User journeys written (JOURNEY-mobile-reset-token-hash-bridge.md)

## Refs

- ADR-0389 (token_hash email auth + OTP length contract)
- ADR-0368 (mobile auth universal-link bridge), ADR-0374, ADR-0021
- `apps/mobile/app/(auth)/verify.tsx:109` (reset redirectTo)
- `apps/web/src/app/api/auth/callback/route.ts` (token_hash handler)
- `supabase/email-templates/reset-password`, `supabase/email-templates/README.md`
