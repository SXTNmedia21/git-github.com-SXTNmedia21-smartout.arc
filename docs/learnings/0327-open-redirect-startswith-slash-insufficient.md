---
title: "Open-redirect guard: startsWith('/') is insufficient — use validateReturnTo"
id: LEARNING_0327
status: canonical
layer: learning
created: 2026-05-21
updated: 2026-05-21
tags: [security, open-redirect, auth, callback, council]
---

# Learning-0327: Open-redirect guard `startsWith("/")` is insufficient

## Context

Post-implementation council (2026-05-21) reviewed the shipped auth-fix stack
(PKCE callback routing, OTP delivery, orphan-cookie scrub). Two reviewers
(system-steward chair + code-reviewer) independently flagged an open redirect
in `apps/web/src/app/api/auth/callback/route.ts`.

The route read a user-supplied `next` query param and guarded it with:

```ts
const next = rawNext.startsWith("/") ? rawNext : "/dashboard";
```

then later did `NextResponse.redirect(new URL(next, origin))` on three
post-exchange branches (existing-user, signup-completed, fallback).

## Discovery

`startsWith("/")` is the textbook-incomplete open-redirect check. A
**protocol-relative** value like `//evil.com` passes it, and
`new URL("//evil.com", "https://app.smartout.ai")` resolves to
`https://evil.com/` — the WHATWG URL parser treats `//host` as an authority
and discards the `origin` base. `/\evil.com` is normalised to a same-origin
path (`\` → `/`), so only the `//` (and `://`, backslash) cases are live —
but `//evil.com` is a working post-auth phishing vector reachable via a
crafted magic-link/OTP callback URL.

Crucially: the project **already had** the correct guard.
`apps/web/src/lib/safe-redirect.ts` `validateReturnTo()` rejects `//`, `://`,
and `\`, and was already used at `apps/web/src/app/login/page.tsx:149`. The
callback route simply didn't use it. The auth-fix stack *widened* the blast
radius by funneling reset-password + OTP + admin-login through this one
handler with an attacker-influenceable `next`.

Fix: `const next = validateReturnTo(rawNext) ?? "/dashboard";` (commit
`c60839c72`). Verified: `//evil.com`, `/\evil.com`, `https://evil.com` →
`/dashboard` fallback; legit relative paths preserved.

## Impact

- **Any redirect built from a user-supplied path must go through
  `validateReturnTo`, never a bare `startsWith("/")`.** Grep new
  `NextResponse.redirect(new URL(<var>, origin))` sites for this.
- When a shared helper already exists for a security check, an audit smell is
  "this surface re-implements the check inline" — the inline copy is where the
  hole hides. Same class as L-0176 (docstring claims compliance, body drifts):
  here the *guard exists centrally* but a new surface rolled its own weaker one.
- Council value: two reviewers found it independently; code-reviewer supplied
  the `new URL` protocol-relative trace + the pre-existing `validateReturnTo`
  location, turning "looks risky" into "confirmed + one-line fix."
- Sibling enumeration finding same council: `signInWithOtp({shouldCreateUser:
  false})` returns `otp_disabled` for non-existent emails (supabase/auth#1547);
  surfacing the raw error leaks account existence. Treat the signal as success.

## References

- Commit `c60839c72` (remediation), council verdict APPROVE WITH CHANGES.
- `apps/web/src/lib/safe-redirect.ts` — `validateReturnTo`.
- `apps/web/src/app/api/auth/callback/route.ts` — fixed guard.
- supabase/auth#1547 — OTP enumeration via `shouldCreateUser:false`.
- Sibling learnings: L-0176 (docstring drift), L-0177 (silent fallback).
