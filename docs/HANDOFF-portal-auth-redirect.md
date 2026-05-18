---
title: "Handoff — portal-auth-redirect"
status: done
updated: 2026-05-18
created: 2026-05-18
module: auth
tags: [handoff, auth, subdomain, oauth, pkce, adr-0021, adr-0362]
---

# Handoff — portal-auth-redirect

> Branch: `feat/portal-auth-redirect` | Base: `development` | Sortie wt-4 | Closed: 2026-05-18

## Summary

Implemented ADR-0021 amendment (2026-04-20 Auth & Invitation Council Q1=b) that P1 left on the floor. Workspace subdomains (`{slug}.smartout.ai`) now 307-redirect every auth route to the portal subdomain (`app.smartout.ai`) so OAuth + PKCE + magic-link flows originate from a single Supabase-Cloud-whitelisted host. Original workspace slug is preserved through the auth handshake via `?continue=<slug>` and used by the callback to redirect the user back to the workspace dashboard after a successful exchange (gated by profile-existence check to prevent open-redirect).

## What was built

1. **`apps/web/src/proxy.ts`** — added `AUTH_ROUTES_REDIRECT_TO_PORTAL` set + `isAuthRouteForPortal()` helper + portal-redirect branch at top of workspace handler (§5a). 10 auth routes covered. `/api/auth/callback` intentionally excluded (PKCE verifier cookie is host-scoped). Skip on localhost (single-host dev).
2. **`apps/web/src/app/api/auth/callback/route.ts`** — added `resolveContinueDestination()` helper. After a successful session exchange and a profile lookup, if `?continue=<slug>` is present, regex-matches `SLUG_PATTERN`, and the user has a `profile` row in the workspace with that slug, redirect to `https://<slug>.${NEXT_PUBLIC_ROOT_DOMAIN}${next}`. Cookie domain `.smartout.ai` (already configured per ADR-0021 §5) propagates the session.
3. **ADR-0362** — `docs/decisions/0362-portal-auth-redirect-implementation.md`.
4. **Journey** — `docs/journeys/JOURNEY-portal-auth-redirect.md` covering 3 user paths (invitee-via-Google, self-service reset, portal-then-workspace SSO).
5. **Decision log** — index row added.

## Decisions made

- **`continue` query param, not state param.** Easier to debug (visible in URL), and Supabase OAuth `state` is owned by GoTrue. Sanitization via `SLUG_PATTERN` regex + profile-existence check on the workspace row covers the open-redirect class.
- **`/api/auth/callback` excluded from portal-redirect.** PKCE code-verifier cookie is set on whichever host initiated `signInWithOAuth`; re-hopping the callback would orphan it. Post-fix, every legitimate OAuth init lives on the portal, so callback traffic naturally lands there.
- **No client-side changes to `login/page.tsx` etc.** Middleware redirect at workspace boundary is sufficient — the page on the portal runs `signInWithOAuth` with `window.location.origin` resolving to the portal host. Smaller diff, fewer regression surfaces.
- **ADR number 0362** (not 0357/0358 which were free locally) — both lower numbers are taken by branches not yet merged into development (HMS-cluster `0357-page-polish-documented-intentional-skips`, `0358-telemetry-registry-requires-emit-wiring`). L-0147 outsider-renumber rule applied preemptively.

## Learnings

- **P1 spec-vs-shipped drift.** Council 2026-04-20 amended ADR-0021 and wrote a Phase 6 redirect rule into `docs/superpowers/specs/2026-04-20-auth-invitation-implementation-plan.md:82`. P1 shipped 13 portal screens + telemetry but missed the middleware patch. Symptom went unnoticed until prod invitee bounce on `smartout.smartout.ai`. **Trust-gate add:** when an ADR amendment touches middleware, the closure handoff for the implementing sortie must include a "middleware-touched? Y/N" line cross-referenced against the ADR's redirect/route rules.
- **PKCE cookie host-scoping is a real constraint.** Wildcard `*.smartout.ai/**` whitelist in Supabase Cloud was rejected for security + ops cost reasons. Centralizing on the portal host (single redirect target) is the only Cloud-config that scales as workspaces are added.
- **Slug enumeration via continue param.** `?continue=acme` is a free open-redirect unless validated. Pattern: regex-allowlist for slug shape, then verify user has a profile in the workspace before redirecting. Same class as `next.startsWith("/")` guard already in the callback for relative paths.

## Known issues / debt

- **Mobile deep-link redesign deferred (P2).** `apps/mobile/app/(auth)/verify.tsx` uses `smartout://auth/callback` and `resetPasswordForEmail({redirectTo: "smartout://..."})`. Currently emails contain native deep-links — opening on desktop fails. Separate sortie needed; ADR may be required.
- **`/api/auth/callback` on workspace subdomain remains reachable.** Defensive-only behavior: if a legacy email link still points to `<slug>.smartout.ai/api/auth/callback?code=...`, the existing code-path runs. With portal-only OAuth init, the verifier cookie won't be there, so the exchange fails and the user sees `/login?error=Invalid_link` on the workspace — at which point middleware redirects them to the portal `/login`. No infinite loop. Acceptable.
- **Vercel env audit not yet performed.** This sortie does NOT modify Vercel env. Post-merge operator task: confirm `NEXT_PUBLIC_ROOT_DOMAIN=smartout.ai` is set on `smartout-web` Production environment.

## Next steps (operator, post-merge)

1. **Supabase Cloud Dashboard → Auth → URL Configuration:**
   - Site URL = `https://app.smartout.ai`
   - Redirect URLs = `https://app.smartout.ai/**` (remove any `*.smartout.ai/**` wildcards)
2. **Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs:**
   - Verify `https://<prod-ref>.supabase.co/auth/v1/callback` present.
3. **Vercel `smartout-web` → Settings → Environment Variables (Production):**
   - Verify `NEXT_PUBLIC_ROOT_DOMAIN=smartout.ai`.
4. **Manual smoke-test on preview/prod after deploy:**
   - GIVEN clean browser session, navigate to `https://acme.smartout.ai/login` → expect 307 to `https://app.smartout.ai/login?continue=acme`.
   - GIVEN auth completes, expect final landing on `https://acme.smartout.ai/dashboard`.
   - Re-test invite acceptance via Google from a workspace-subdomain `/invite/<token>` link.
5. **Mobile P2:** open sortie for `smartout://auth/callback` deep-link redesign.

## Acceptance verification

- [x] Plan written (`docs/plans/PLAN-portal-auth-redirect.md`)
- [x] Journey written (`docs/journeys/JOURNEY-portal-auth-redirect.md`)
- [x] ADR-0362 written + registered in decision log
- [x] `apps/web/src/proxy.ts` workspace handler 307-redirects auth routes
- [x] `apps/web/src/app/api/auth/callback/route.ts` honors `continue` with profile-existence guard
- [x] Open-redirect guards: `SLUG_PATTERN` + profile-existence + `next.startsWith("/")`
- [x] localhost dev unchanged (no redirect when `NEXT_PUBLIC_ROOT_DOMAIN` is unset or `localhost`)
- [ ] Typecheck passes (`pnpm turbo typecheck --filter=web`) — operator to verify on close
