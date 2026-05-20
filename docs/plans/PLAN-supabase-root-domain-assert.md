---
title: "Plan — NEXT_PUBLIC_ROOT_DOMAIN production assert for Supabase cookie domain"
status: done
updated: 2026-05-18
created: 2026-05-18
module: supabase
tags: [plan, supabase, env, auth, cookie-domain, production-safety]
---

# Plan — Supabase root-domain assert (F2)

> Branch: `feat/supabase-root-domain-assert` | Worktree: /home/sxtnl/dev/smartout.ai-wt-1 | Base: `development` | Module: supabase | Started: 2026-05-18

## Goal
Hard-fail at module load when `NEXT_PUBLIC_ROOT_DOMAIN` is unset in production, preventing cookie-domain drift between browser and server Supabase clients.

## Root Cause
F0 Track A architecture review of ADR-0357 found that `client.ts:13` and `server.ts:7` both consume `NEXT_PUBLIC_ROOT_DOMAIN` with a silent fallback to host-only. In production, a missing env var causes the browser client to write a host-scoped cookie (`app.smartout.ai`) while the server reads `.smartout.ai` — disjoint scopes, invisible cookie, auth race.

## Fix
See ADR-0375. Shared assert helper called at module load in both client.ts and server.ts.

## Files
- `packages/supabase/src/_assert-root-domain.ts` (new)
- `packages/supabase/src/client.ts` (import + top-level call)
- `packages/supabase/src/server.ts` (import + top-level call)
- `docs/decisions/0375-prod-assert-root-domain-for-supabase-cookie-domain.md` (new ADR)
- `docs/decisions/0000-decision-log.md` (row added)
- `docs/plans/PLAN-supabase-root-domain-assert.md` (this file)
- `docs/HANDOFF-supabase-root-domain-assert.md`
- `docs/journeys/JOURNEY-supabase-root-domain-assert.md`

## Tasks
- [x] Read client.ts + server.ts — identify NEXT_PUBLIC_ROOT_DOMAIN call sites
- [x] Write `_assert-root-domain.ts` helper
- [x] Wire assert into client.ts (import + top-level call after imports)
- [x] Wire assert into server.ts (import + top-level call after imports)
- [x] Write ADR-0375
- [x] Add decision log row after ADR-0358
- [x] Write plan (this file)
- [x] Write handoff
- [x] Write minimal journey
- [x] Typecheck

## Acceptance Criteria
- [x] `tsc --noEmit` exits 0 in `packages/supabase`
- [x] `_assert-root-domain.ts` is the single source of the assert — not duplicated in client.ts or server.ts
- [x] `assertRootDomain()` is called before any `getCookieDomain()` / `getServerCookieDomain()` logic runs
- [x] In `NODE_ENV=production && VERCEL_ENV=production` with no env var: throws with message citing ADR-0357
- [x] In any other env with no env var: warns once, no throw
- [x] Decision log updated
- [x] User journeys written

## Out of scope
- Other env-var asserts (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY already use `!` assertion).
- `apps/web/src/env.ts` validators (separate Zod layer of defense).
- Preview Supabase branch DB provisioning (ADR-0360 scope).
