---
title: "Plan — join-auth-prefetch-loop-fixes"
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: onboarding
tags: [plan, join, wizard, auth, supabase, brreg]
---

# Plan — join-auth-prefetch-loop-fixes

> Branch: `feat/join-auth-prefetch-loop-fixes` | Worktree: /home/sxtnl/dev/smartout.ai-wt-1 | Base: `development` | Module: onboarding | Started: 2026-05-18

## Goal

Repair three bugs in the public `/join` wizard surfaced on prod (app.smartout.ai, 2026-05-18):

1. Step 5 "Meny" never prepopulates from Scrapling intelligence (cuisine, price, menu description).
2. Step 1 fires `/api/scrape/brreg` repeatedly while user types — debounce gated by an unstable callback reference.
3. Final submit (POST /join) returns 500 — `completeSignup` Server Action throws `Not authenticated` after Supabase rotates the refresh token mid-wizard.

## Root causes

**Step 5 prepopulate (Bug 1)**

`apps/web/src/app/join/_context/JoinScrapingProvider.tsx` — `prefetchContent` calls `/api/workspace-intelligence` which returns `{intelligence, content}`. The `content` field carries the LLM classifications (`cuisine_types`, `price_category`, `restaurant_type`, `menu_description`). The route returns `intelligence` un-merged. Provider stored `prefetchedContent.intelligence = data.intelligence` without folding `data.content` into it. Step 3's prefetch-apply path then wrote bare-enriched intel into wizard state; Step 5 found empty arrays + null values + missing `llm_*` and `menu_description` fields → no prepopulate.

Self-fetch path in `useWorkspaceIntelligence.callApi` does the merge correctly. Bug only manifests when prefetch (triggered from Step 1) completes before Step 3 mount — i.e. realistic live traffic.

**BRREG loop (Bug 2)**

`apps/web/src/app/join/_components/Step1Account.tsx` — debounced lookup effect included `lookupBrreg`, `prefetchContent`, `prefetchStatus` in its dependency array. `prefetchContent` is wrapped in `useCallback([prefetchStatus, brregData, scrapedData])` inside `JoinScrapingProvider`. After the first BRREG response, `brregData` mutates → `prefetchContent` identity churns → effect re-runs → new debounce timer → another lookup fires → setState → re-render → loop.

**Auth race (Bug 3)**

`apps/web/src/app/join/_lib/setupActions.ts` and `wizard-definition.ts` — Step 1 `attemptSilentAuth` calls `supabase.auth.signUp` and stores the resulting `access_token` (A1) on wizard state as `_accessToken`. While the user clicks through steps 2-5 the Supabase browser client auto-refreshes; the original refresh token (R1) is consumed and rotated to R2. When `onComplete` POSTs to the Server Action it sends the stale A1.

Server: `supabase.auth.getUser()` cookie path triggers a server-side refresh attempt that races the client's already-completed rotation → `refresh_token_already_used`. Fallback `admin.auth.getUser(accessToken=A1)` also rejected (A1 is now expired/invalid). `user` stays null → throw `Not authenticated` → 500.

## Fix

### Bug 1 — `JoinScrapingProvider.tsx`

Merge `data.content.{menu_description, restaurant_type, cuisine_types, price_category}` into `mergedIntelligence` before storing. Mirror `useWorkspaceIntelligence.callApi` L121-131. Also surface intelligence when `/generate` returns classifications but no long-form copy.

### Bug 2 — `Step1Account.tsx`

Pin volatile callbacks in refs (`lookupBrregRef`, `prefetchContentRef`, `prefetchStatusRef`) refreshed in a parallel `useEffect`. Drop them from the debounce-effect deps. Add `lastLookupKeyRef` so the same `(companyName|city|industry)` tuple is queried at most once until it changes.

### Bug 3 — `wizard-definition.ts` + `setupActions.ts` + `Step1Account.tsx` + `Step6CreateAccount.tsx`

- `wizard-definition.ts` — Before invoking `completeSignup`, call `supabase.auth.getSession()` client-side. This forces the browser client to persist its current (post-rotation) tokens to cookies so the Server Action reads fresh state. Drop `_accessToken` read.
- `setupActions.ts` — Drop `accessToken` parameter. Strategy: (a) read cookie session via `getSession()` (does NOT trigger refresh, so no race), (b) fall back to `getUser()` only if no session, (c) throw `Not authenticated` on both null.
- `Step1Account.tsx` + `Step6CreateAccount.tsx` — Stop writing `_accessToken` into wizard state. Cookies carry the session; the wizard state no longer needs a parallel token store.

## Tasks

- [x] Bug 1 — merge LLM classifications into intel in `prefetchContent`
- [x] Bug 2 — stable ref-callbacks + lookup-key dedupe in Step1 effect
- [x] Bug 3 — drop `_accessToken`; `getSession`-first auth resolution; client-side session warmup before Server Action POST
- [ ] Local smoke: `pnpm run dev` → /join Strøm Mat & Bar → verify Step 5 chips + no BRREG storm in Network → submit Step 6 succeeds
- [ ] Write user journeys (`docs/journeys/JOURNEY-join-auth-prefetch-loop-fixes.md`)
- [ ] Write handoff (`docs/HANDOFF-join-auth-prefetch-loop-fixes.md`) at closure
- [ ] `pnpm turbo typecheck` clean
- [ ] `close-feature.sh 1`

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] /api/scrape/brreg called at most once per stable (companyName, city, industry) tuple
- [ ] Step 5 chips/select prepopulate when prefetch finished before Step 3
- [ ] POST /join completes without 500 across (a) brand-new signUp, (b) existing-account signIn fallback, (c) >5 min Step1→Step6 idle window
- [ ] No `refresh_token_already_used` in Vercel runtime logs across smoke

## Out of scope

- L-0302 / schema drift items
- Onboarding (`/onboarding`) auth flow
- Mobile parity (web-only fix)
