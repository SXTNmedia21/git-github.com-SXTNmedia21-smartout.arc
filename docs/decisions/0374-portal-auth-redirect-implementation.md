---
id: ADR-0374
title: "Portal Auth Redirect — Implement ADR-0021 Amendment"
status: accepted
date: 2026-05-18
deciders: pontus, claude
supersedes: []
superseded_by: []
relates_to: [ADR-0021, ADR-0167, ADR-0168]
tags: [auth, subdomain, oauth, pkce]
---

# ADR-0374 — Portal Auth Redirect — Implement ADR-0021 Amendment

## Status

Accepted.

## Context

ADR-0021 was amended on 2026-04-20 by the Auth & Invitation Council (Q1=b) to declare `app.smartout.ai` the canonical auth portal subdomain. Workspace subdomains (`{slug}.smartout.ai`) were mandated to redirect every auth-route request to the portal so OAuth + PKCE + magic-link flows originate from one Supabase-Cloud-whitelisted host. P1 (`docs/superpowers/specs/2026-04-20-auth-invitation-implementation-plan.md`) shipped 13 portal screens and telemetry events but skipped Phase 6 — the actual middleware redirect.

Symptom on production (2026-05-18): invitee on `smartout.smartout.ai/invite/<token>` clicks "Continue with Google" → `signInWithOAuth({ redirectTo: window.location.origin + "/api/auth/callback" })` resolves to `https://smartout.smartout.ai/api/auth/callback`. Supabase Cloud's Redirect URLs whitelist contains only the portal host, so GoTrue refuses the workspace redirectTo OR PKCE code-verifier cookie ends up scoped to a host that the callback can't read. `exchangeCodeForSession` fails → callback redirects to `/login?error=Invalid_link` on the workspace subdomain. Same failure class affects reset-password email links, magic-link OTP, and the entire `/invite/<token>` path.

Operators cannot whitelist `*.smartout.ai/**` in Supabase Cloud as a workaround — every new workspace slug would need re-registration, and the security surface (open-redirect via subdomain enumeration) grows unboundedly.

## Decision

Implement the missing middleware layer. Two changes:

1. **`apps/web/src/proxy.ts`** — when `subdomain.type === "workspace"` and `pathname` matches an entry in `AUTH_ROUTES_REDIRECT_TO_PORTAL` (`/login`, `/signup`, `/join`, `/join-complete`, `/reset-password`, `/update-password`, `/invite`, `/confirm-email`, `/select-workspace`, `/welcome`), 307-redirect to `https://app.${NEXT_PUBLIC_ROOT_DOMAIN}${pathname}${search}` with `?continue=<slug>` appended (preserving operator-supplied `continue` if present). Skipped on localhost (single-host dev).

2. **`apps/web/src/app/api/auth/callback/route.ts`** — after `exchangeCodeForSession` succeeds AND `getUser()` returns, read `continue` query param. If it matches `SLUG_PATTERN` AND the user has a `profile` row in the workspace with that slug, redirect to `https://<slug>.${NEXT_PUBLIC_ROOT_DOMAIN}${next}`. Profile-existence check prevents open-redirect / slug-enumeration phishing. Cookie domain `.smartout.ai` propagates the session.

`/api/auth/callback` is intentionally **excluded** from the redirect set: PKCE code-verifier cookies are host-scoped to whichever subdomain initiated `signInWithOAuth`. Re-hopping a legitimate callback would orphan the verifier. Post-fix, all OAuth-init runs on the portal, so legitimate callback traffic naturally lands on the portal.

## Consequences

**Positive:**

- Supabase Cloud Redirect URLs whitelist stays minimal: only `https://app.smartout.ai/**`. New workspace slugs require no auth-side configuration.
- Single PKCE-verifier-cookie host eliminates `Invalid_link` callback failures across Google OAuth, magic-link OTP, and password reset.
- Session sharing via `.smartout.ai`-scoped cookies (already implemented per ADR-0021 §5) handles cross-subdomain SSO without further changes.
- `continue` round-trip preserves invitee/operator intent: arrive on workspace → bounce to portal → auth → return to workspace dashboard.

**Negative / Risks:**

- One extra hop per auth navigation when user starts from a workspace subdomain (307 → portal → action). Acceptable: auth is rare on the workspace surface.
- `continue` parameter requires sanitization (`SLUG_PATTERN` regex + profile-existence check). Missing either guard would create open-redirect.
- Legacy bookmarks to workspace auth URLs still work via the middleware redirect — no breakage — but the visible URL changes during the auth flow. Acceptable.

**Operator follow-up (post-merge):**

1. Set Supabase Cloud `Site URL = https://app.smartout.ai`.
2. Constrain Supabase Cloud Redirect URLs to `https://app.smartout.ai/**` only (remove any `*.smartout.ai/**` wildcards if present).
3. Verify `NEXT_PUBLIC_ROOT_DOMAIN=smartout.ai` set in Vercel production env (already required by `packages/supabase/src/client.ts` cookie-domain logic — but worth a sanity check).
4. Audit Google Cloud OAuth Client → Authorized redirect URIs: only `https://<prod-ref>.supabase.co/auth/v1/callback` is required.

## Alternatives Considered

- **Wildcard whitelist in Supabase Cloud.** Rejected by Pontus 2026-05-18 — would whitelist every existing and future workspace subdomain, enlarging open-redirect surface and forcing manual sync per new workspace.
- **Client-side redirect on auth pages.** Rejected — would require JS execution before the redirect could happen, leaving a flash of UI on the wrong host and breaking direct-clicked email links (no JS context). Middleware redirect is server-side and zero-flash.
- **Per-workspace portal subdomain (e.g. `auth.acme.smartout.ai`).** Rejected — defeats the purpose of consolidating PKCE-verifier-cookie scope.

## References

- ADR-0021 (subdomain-workspace-routing) — amended 2026-04-20.
- ADR-0167 (invitation-tokens-as-credentials).
- ADR-0168 (magic-link-as-default-auth-method).
- Council: `docs/superpowers/specs/2026-04-20-auth-invitation-implementation-plan.md` (Q1=b, Phase 6).
- Symptom trace: `https://smartout.smartout.ai/invite/...` → callback → `/login?error=Invalid_link` (`apps/web/src/app/api/auth/callback/route.ts:76` pre-fix).
- Cookie-domain logic: `packages/supabase/src/client.ts:6`, `packages/supabase/src/middleware.ts:6`.
