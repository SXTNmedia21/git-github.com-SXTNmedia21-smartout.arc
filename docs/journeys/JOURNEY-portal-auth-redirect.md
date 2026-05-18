---
title: "Journey — Portal Auth Redirect"
status: done
updated: 2026-05-18
created: 2026-05-18
module: auth
tags: [journey, auth, subdomain, oauth, adr-0021]
---

# Journey — Portal Auth Redirect

Implements ADR-0021 amendment (2026-04-20): all auth surfaces run on `app.smartout.ai`. Workspace subdomains 307-redirect auth routes to the portal so OAuth + PKCE + magic-links originate from a single Supabase-Cloud-whitelisted host.

---

## Journey 1: Invitee accepts invite from workspace subdomain via Google

**Precondition:** Admin in workspace `acme` has issued invitation token `T`. The invite email links to `https://acme.smartout.ai/invite/T`.

1. Invitee clicks email link → browser navigates to `https://acme.smartout.ai/invite/T`.
2. Middleware `proxy.ts` workspace handler detects auth-route → 307 → `https://app.smartout.ai/invite/T?continue=acme`.
3. Browser follows → portal `/invite/[token]` page renders. User clicks "Logg inn med Google".
4. `signInWithOAuth({ redirectTo: "https://app.smartout.ai/api/auth/callback?next=/dashboard" })` runs on portal. PKCE code-verifier cookie set with domain `.smartout.ai`.
5. Google → Supabase Cloud GoTrue (`<ref>.supabase.co/auth/v1/callback`) → 302 to portal callback with `?code=...`. Continue param is preserved on the portal callback URL (next hop appends it).
6. Callback runs on portal: `exchangeCodeForSession(code)` succeeds (verifier cookie available — same host). Session established. Profile lookup finds invitee's row (created by accept-invitation Edge Function).
7. `resolveContinueDestination` validates `continue=acme` → user has profile in workspace → returns absolute URL `https://acme.smartout.ai/dashboard`.
8. 307 → `https://acme.smartout.ai/dashboard`. Browser sends `.smartout.ai`-scoped session cookies on the new request → middleware `getUser()` resolves → workspace dashboard renders.

**Postcondition:** Invitee is authenticated and viewing acme dashboard. Session cookies shared across all `*.smartout.ai` subdomains.

**Error paths:**

- Step 4 fails (Google declines, network) → `oauthError` shown on `/login`. No redirect to workspace.
- Step 6 `exchangeCodeForSession` fails → callback returns 307 `/login?error=Invalid_link` on the portal (not the workspace — the prior bug class).
- Step 7 slug validation fails (slug malformed, workspace deleted, no profile) → fall through to `next || "/dashboard"` on portal. User lands at portal `/select-workspace` to pick another workspace.

---

## Journey 2: Existing user resets password from workspace subdomain

**Precondition:** Active user has a session on `acme.smartout.ai` but forgot the password (rare — typically Bubble-migration force-reset flag fires instead, but a self-service reset can happen too).

1. User navigates to `https://acme.smartout.ai/reset-password`.
2. Middleware 307 → `https://app.smartout.ai/reset-password?continue=acme`.
3. Portal page renders. User enters email → `resetPasswordForEmail(email, { redirectTo: "https://app.smartout.ai/update-password" })` (portal-origin).
4. Supabase Cloud emails recovery link pointing at portal `/update-password` (matches Cloud `Site URL`). User clicks.
5. Portal `/update-password` consumes the recovery hash → `updateUser({ password })` → success.
6. Portal redirects to `/select-workspace` (existing behavior). User picks acme → `https://acme.smartout.ai/dashboard`.

**Postcondition:** Password rotated, user lands on workspace dashboard.

**Error paths:**

- Mail never arrives → user re-requests on the same portal page. Generic message hides account existence (`reset-password/page.tsx:69`).
- Hash expired → portal `/update-password` bounces to `/reset-password` (L-0089 ghost-route guard).

---

## Journey 3: User logged into portal navigates to a workspace subdomain

**Precondition:** User completed login on `app.smartout.ai/login`. Session cookies set with `domain=.smartout.ai`.

1. User clicks workspace card on portal `/select-workspace` → navigates to `https://acme.smartout.ai/dashboard`.
2. Browser sends `.smartout.ai` session cookies on the cross-subdomain request.
3. Middleware `updateSession()` runs on workspace host → reads cookies → `getUser()` returns user → workspace dashboard renders.
4. No additional auth handshake. No redirect to portal.

**Postcondition:** Single-sign-on across portal and any workspace subdomain via shared cookie.

**Error paths:**

- Cookie domain misconfigured (missing `NEXT_PUBLIC_ROOT_DOMAIN` on Vercel) → cookies scoped to portal host → workspace request unauthenticated → falls through to existing auth-required logic (eventually redirects back to portal `/login`). Operator fix: set env var.

---

## Out-of-scope (separate sortie)

- Mobile deep-link path (`smartout://auth/callback`) — not covered here.
- Removing legacy `/login` etc. from `PUBLIC_ROUTES` — kept as defense-in-depth.
- Supabase Cloud config update — operator task post-merge (set `Site URL = https://app.smartout.ai`, restrict Redirect URLs to portal-only).
