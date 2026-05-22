---
title: "Mobile password-reset lands native via conditional recovery template"
id: ADR-0390
status: accepted
layer: decision
created: 2026-05-22
updated: 2026-05-22
module: auth
tags: [auth, mobile, email-templates, universal-link, gotrue, token_hash, recovery]
supersedes: []
superseded_by: []
relates_to: [ADR-0368, ADR-0389, ADR-0021, ADR-0132, ADR-0133]
---

# ADR-0390 — Mobile password-reset lands native via conditional recovery template

## Status

Accepted (2026-05-22).

## Context and Problem Statement

`supabase/email-templates/reset-password` is a single GoTrue template served
for ALL password-reset emails regardless of call site. Before this ADR the
recovery link href was hardcoded:

```
{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/update-password
```

This is correct for the **web track** (no `redirectTo` — server-side verify in
`/api/auth/callback`), but it is wrong for the **mobile track**, where
`apps/mobile` calls `resetPasswordForEmail` with
`redirectTo: "https://app.smartout.ai/m/update-password"`.

On the mobile track the hardcoded href ignores `redirectTo` and sends the user
to the web callback, which handles the token correctly but drops the user in the
web browser — not the native app. The user must then navigate back to the app
and re-authenticate, degrading the reset UX.

ADR-0368 established `https://app.smartout.ai/m/update-password` as the
Universal-Link bridge path for mobile password recovery. ADR-0389 locked the
template to token_hash + server-side verify. This ADR fulfils the missing link:
route mobile resets to the bridge URL without duplicating or forking the template.

## Decision Drivers

- One GoTrue "Reset Password" slot — cannot have two separate templates for
  web and mobile.
- One-mechanism-per-email contract (ADR-0389 §3.3) — link-only, no `{{ .Token }}`
  code in the recovery email.
- GoTrue populates `{{ .RedirectTo }}` only when the caller passes a `redirectTo`
  value that is in the Supabase Redirect URLs allow-list. When `redirectTo` is
  absent or blocked, `{{ .RedirectTo }}` is empty string — a falsy value in Go
  templates.
- Web track must keep its audited `/api/auth/callback` path (ADR-0389 §3.1)
  — the open-redirect guard (`ALLOWED_OTP_TYPES` allow-list) must not be
  bypassed.
- Fallback for app-not-installed: the bridge web route
  `apps/web/src/app/m/update-password/page.tsx` ALREADY handles `token_hash`
  server-side (same mechanism as web track). So mobile-path links are safe even
  when opened in a desktop browser.

## Considered Options

1. **Strategy A — Go-template conditional on `{{ .RedirectTo }}`** (chosen)
   Single template; one `{{ if .RedirectTo }}…{{ else }}…{{ end }}` block wraps
   only the href. Web call (no `redirectTo`) uses the existing callback path;
   mobile call (with `redirectTo`) uses the bridge URL.

2. **Strategy B — Two separate templates (mobile + web)** — not a GoTrue option.
   GoTrue has one "Reset Password" slot per project. Not available without a
   custom SMTP + template router, which would add infrastructure for a
   one-line conditional.

3. **Strategy C — Always use `{{ .RedirectTo }}`; set it to the web callback on
   web calls** — Requires every web call site to pass an explicit `redirectTo`,
   touching `apps/web/` call sites. Over-complicated for a problem solvable in
   the template alone.

4. **Strategy D — Serve both destinations from `/api/auth/callback` via a
   `?target=mobile` param** — Would require `apps/web/` callback changes;
   server-side redirect to the bridge URL after verifying the token. Rejected:
   (a) adds server-side logic to a route that CLAUDE.md forbids touching lightly;
   (b) the Universal-Link interception MUST happen on the client's first HTTP
   request to `https://app.smartout.ai/m/…` — a server redirect after `/api/auth/callback`
   arrives too late for iOS Associated Domains / Android App Links verification.
   (c) it leaves the audited callback untouched (good) but adds a redirect hop
   and a new param to a security-sensitive route (bad).

## Decision Outcome

Chosen option: **Strategy A — conditional `{{ if .RedirectTo }}`**, because it
requires a single 3-line change in the template, touches no `apps/web/` or
`apps/mobile/` code, preserves both the audited `/api/auth/callback` path for
web and the Universal-Link bridge path for mobile, and respects the
one-mechanism-per-email contract.

### Template diff (the only code change)

**Before:**
```html
<a href="{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/update-password" …>
```

**After:**
```html
<a href="{{ if .RedirectTo }}{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery{{ else }}{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/update-password{{ end }}" …>
```

### Flow — web track (redirectTo absent)

1. `resetPasswordForEmail(email)` — no `redirectTo`.
2. GoTrue renders template with empty `{{ .RedirectTo }}` → `{{ else }}` branch.
3. Email link → `https://app.smartout.ai/api/auth/callback?token_hash=…&type=recovery&next=/update-password`.
4. `/api/auth/callback` calls `verifyOtp({token_hash, type:"recovery"})` server-side.
5. User lands at `/update-password` in the browser. No change from pre-ADR behaviour.

### Flow — mobile track (redirectTo set to bridge URL)

1. `resetPasswordForEmail(email, { redirectTo: "https://app.smartout.ai/m/update-password" })`.
2. GoTrue validates `redirectTo` against the Redirect URLs allow-list (must include
   `https://app.smartout.ai/m/**` or the exact path — see Operator Requirement below).
   If rejected, GoTrue drops the `redirectTo` → email falls through to web `{{ else }}`
   branch (safe degradation).
3. GoTrue renders template with `{{ .RedirectTo }}` = `https://app.smartout.ai/m/update-password`
   → `{{ if }}` branch.
4. Email link → `https://app.smartout.ai/m/update-password?token_hash=…&type=recovery`.
5. **App installed:** iOS Associated Domains / Android App Links intercepts the
   HTTPS URL before browser opens; native screen at `app/(auth)/m/update-password`
   reads `token_hash` from URL params and calls `verifyOtp` in-app.
6. **App not installed / desktop:** web bridge route
   `apps/web/src/app/m/update-password/page.tsx` renders; reads `token_hash` +
   `type` from query string and verifies server-side — identical mechanism to the
   web track. User sets password in browser.

### Fallback guarantee

If `redirectTo` is empty or blocked by GoTrue's allow-list, `{{ .RedirectTo }}`
is falsy → template falls back to the web `/api/auth/callback` path automatically.
No broken emails regardless of call site.

## Operator Requirement

**Supabase dashboard → Authentication → URL Configuration → Redirect URLs**
must include:

```
https://app.smartout.ai/m/**
```

(A wildcard entry covers all current and future `/m/` bridge paths, including
`/m/update-password`.) Without this entry GoTrue rejects the mobile `redirectTo`
silently — the email still delivers and lands on the web track, but the
native-app landing is lost.

This is an operator step (dashboard setting, not code). It must be applied to
**production** before mobile password-reset is exposed to users.

## Verification Gate

Local verification via Inbucket (Supabase local):

1. `npx supabase start` (local stack with Inbucket).
2. **Web test:** call `resetPasswordForEmail(email)` with no `redirectTo`;
   read email in Inbucket (`http://localhost:54324`); confirm href contains
   `/api/auth/callback?token_hash=…&type=recovery&next=/update-password`.
3. **Mobile test:** call `resetPasswordForEmail(email, { redirectTo: "https://app.smartout.ai/m/update-password" })`;
   read email in Inbucket; confirm href is
   `https://app.smartout.ai/m/update-password?token_hash=…&type=recovery`.
4. Confirm `{{ if … }}{{ else }}{{ end }}` block is balanced (no dangling
   template tags) by checking rendered output contains exactly one `href=`.

## Rules & Consequences

- **Good, because** single template slot, zero `apps/web/` or `apps/mobile/`
  changes, both tracks fully functional, open-redirect guard on web unchanged.
- **Good, because** fallback is web track — any misconfigured allow-list delivers
  a working (non-native) reset, not a broken email.
- **Bad, because** GoTrue allow-list is a dashboard setting, not code-enforced.
  Missing it = silent degradation to web track (logged here so it is not a
  surprise).
- **Agent Impact:** When adding new `/m/<route>` bridge paths that need a
  `redirectTo`, add them to the Supabase allow-list first. The template
  conditional is generic — any HTTPS `redirectTo` that clears GoTrue's allow-list
  will be used as the link destination.

## References

- ADR-0368 — Mobile Auth Universal-Link Bridge (`/m/update-password` route declared,
  bridge-only P3; this ADR activates the email-side wiring).
- ADR-0389 — OTP length contract + token_hash email auth (one-mechanism-per-email,
  link-only recovery, server-side verify pattern).
- ADR-0021 — Subdomain workspace routing (portal doctrine).
- ADR-0132 — Mobile AI routing (thin client, no direct-to-capability traffic).
- ADR-0133 — Web-composes-mobile-executes surface boundary.
- `supabase/email-templates/reset-password` — the edited template.
- `supabase/email-templates/README.md` — link-format section updated.
- `apps/web/src/app/m/update-password/page.tsx` — web bridge fallback (app-not-installed).
- `apps/mobile/app/(auth)/m/update-password.tsx` — native screen (P3, bridge-only pre-publish).
