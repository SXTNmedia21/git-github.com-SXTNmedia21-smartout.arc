---
title: "Plan — portal-auth-redirect"
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: auth
tags: [plan, auth, subdomain, oauth, adr-0021]
---

# Plan — portal-auth-redirect

> Branch: `feat/portal-auth-redirect` | Worktree: /home/sxtnl/dev/smartout.ai-wt-4 | Base: `development` | Module: auth | Started: 2026-05-18

## Goal

Implement ADR-0021 amendment (2026-04-20 Auth & Invitation Council Q1=b): route all auth pages through `app.smartout.ai` portal subdomain by 307-redirecting from workspace subdomains. Fixes prod Google OAuth `/login?error=Invalid_link` bounce on `{slug}.smartout.ai` and unblocks reset-password + OTP + invite-accept flows without requiring `*.smartout.ai/**` in Supabase Cloud Redirect URLs whitelist.

## Background

- ADR-0021 amended 2026-04-20: `app.smartout.ai` canonical auth portal. Workspace subdomains MUST redirect auth routes to portal.
- Council 2026-04-20 (`docs/superpowers/specs/2026-04-20-auth-invitation-implementation-plan.md`) Q1=b APPROVED.
- P1 shipped 13 portal screens + telemetry. Phase 6 redirect rule (workspace → portal) was **never implemented** — `apps/web/src/proxy.ts` workspace handler (lines 307-348) has no auth-route redirect.
- Symptom on prod: invitee on `smartout.smartout.ai/invite/<token>` clicks Google → OAuth `redirectTo = https://smartout.smartout.ai/api/auth/callback` → Supabase Cloud Redirect URLs whitelist mismatch → `exchangeCodeForSession` fails → 307 to `/login?error=Invalid_link`.

## Architecture

Two layers:

**L1 — middleware portal-redirect.** `apps/web/src/proxy.ts` workspace handler 307-redirects every auth-route request to `app.smartout.ai`. Original workspace slug preserved as `?continue=<slug>` query param so callback can route back. Skip when `NEXT_PUBLIC_ROOT_DOMAIN` is `localhost` (dev — single-host).

**L2 — callback honors `continue`.** `apps/web/src/app/api/auth/callback/route.ts` after successful session exchange, if `continue=<slug>` matches a workspace the user has profile-access to, redirect to `https://<slug>.smartout.ai/dashboard`. Cookie domain `.smartout.ai` propagates session automatically (per ADR-0021 §5).

Auth routes that redirect:
`/login`, `/signup`, `/reset-password`, `/update-password`, `/invite`, `/confirm-email`, `/select-workspace`, `/welcome`, `/join`.

`/api/auth/callback` does NOT redirect (must run on portal AND remain reachable as final hop — but signInWithOAuth on portal sets `redirectTo` to portal callback, so workspace callback is never invoked legitimately).

## Tasks

- [x] T1: Sortie + plan
- [ ] T2: proxy.ts workspace handler — add `AUTH_ROUTES_REDIRECT_TO_PORTAL` set + redirect logic
- [ ] T3: callback route.ts — honor `?continue=<slug>` after successful exchange, redirect to `https://<slug>.smartout.ai/dashboard`
- [ ] T4: env — document `NEXT_PUBLIC_PORTAL_HOST` (defaults to `app.smartout.ai`); add to `.env.template`
- [ ] T5: subdomain.test.ts — add test cases for portal-redirect logic
- [ ] T6: JOURNEY-portal-auth-redirect.md
- [ ] T7: ADR — register implementation as supplement to 0021 (or close-out note)
- [ ] T8: HANDOFF + close-feature

## Out of scope (P2)

- Mobile deep-link redesign (`smartout://auth/callback`) — separate sortie, ADR-needed
- Removing `/login` etc. from `PUBLIC_ROUTES` on workspace subdomain (keep as defensive — middleware redirect handles it)
- Supabase Cloud config changes (operator task post-merge: set Site URL + Redirect URLs to portal-only)

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Hitting `https://acme.smartout.ai/login` returns 307 to `https://app.smartout.ai/login?continue=acme`
- [ ] Hitting `https://acme.smartout.ai/invite/<token>` returns 307 to `https://app.smartout.ai/invite/<token>?continue=acme`
- [ ] Callback with `?continue=acme` after successful exchange redirects to `https://acme.smartout.ai/dashboard` (if user has profile)
- [ ] Callback without `continue` redirects to `/dashboard` on portal (existing behavior)
- [ ] localhost dev unchanged — no redirects (single-host)
- [ ] Decision log entry registered
- [ ] User journey written
