---
title: "Handoff — join-auth-prefetch-loop-fixes"
status: done
updated: 2026-05-18
created: 2026-05-18
module: onboarding
tags: [handoff, join, wizard, auth, supabase, brreg]
---

# Handoff — join-auth-prefetch-loop-fixes

> Branch: `feat/join-auth-prefetch-loop-fixes` | Worktree: `/home/sxtnl/wsl/smartout.ai-wt-1` | Base: `development` @ 9e2ddfbb6

## Summary

Three independent bugs on prod `/join` wizard (`app.smartout.ai`, observed 2026-05-18) closed in a single sortie:

1. **Step 5 menu prepopulate** never fired from Scrapling intelligence.
2. **Step 1 `/api/scrape/brreg` debounce loop** — same `(name, city, industry)` requeried per state churn.
3. **Final submit 500** — `completeSignup` Server Action threw `Not authenticated` after Supabase refresh-token rotation race.

All three traced to architectural defects, not data drift: the prefetch pipe dropped LLM classifications, an effect's dep array included an unstable callback reference, and a parallel `_accessToken` store in wizard state collided with Supabase auto-rotation.

## Decisions made

| ID | Decision | Where |
|---|---|---|
| ADR-0357 | Drop parallel `_accessToken` store; cookies + `getUser()` are the single source of auth handoff to Server Actions | `docs/decisions/0357-drop-parallel-access-token-store-for-server-action-auth.md` |

Implementation pattern codified in ADR-0357:
- **Client** (before any auth-requiring Server Action POST): `await supabase.auth.getSession()` → `await supabase.auth.getUser()`. The two-step is intentional — `getSession()` triggers refresh on expiry, `getUser()` forces a verified roundtrip and persists rotation to cookies.
- **Server** (inside Server Action): `await supabase.auth.getUser()` once. Do NOT call `getSession()` server-side first — per `@supabase/auth-js` `GoTrueClient.ts:1138-1160`, `__loadSession` still triggers `_callRefreshToken` on expiry regardless of `autoRefreshToken: false`.
- **Wizard state**: never holds Supabase tokens in JavaScript state.

## What was built

### Commits (this branch ahead of development)

```
668434c7c fix(join): repair Step 5 prefetch + BRREG loop + auth-race 500
cd2c40686 docs(join): plan + journeys for join-auth-prefetch-loop-fixes
+ G1 reconcile patches (uncommitted at HANDOFF write — committed in closure step)
```

### Files touched (post-G1 reconciliation)

| File | Change | Bug |
|---|---|---|
| `apps/web/src/app/join/_components/Step1Account.tsx` | ref-pin volatile callbacks, dedupe-key (case-folded incl. industry); drop `_accessToken` writes | 2, 3 |
| `apps/web/src/app/join/_components/Step3About.tsx` | Fallback effect gate switched from `prefetchedContent` truthiness to long-form-copy presence — covers classifications-only prefetch case | 1 |
| `apps/web/src/app/join/_components/Step6CreateAccount.tsx` | Drop dead `accessToken` variable + writes; single-line comment replaces token plumbing | 3 |
| `apps/web/src/app/join/_context/JoinScrapingProvider.tsx` | Merge `data.content.{menu_description, restaurant_type, cuisine_types, price_category}` into `mergedIntelligence` before storing; surface intel when prefetch returned classifications without long-form copy | 1 |
| `apps/web/src/app/join/_lib/setupActions.ts` | Drop `accessToken` param; single `getUser()` call; corrected comment with GoTrueClient citation | 3 |
| `apps/web/src/app/join/wizard-definition.ts` | Pre-action `getSession()` + `getUser()` client-side sync; drop `_accessToken` read | 3 |

### Docs

- `docs/decisions/0357-drop-parallel-access-token-store-for-server-action-auth.md`
- `docs/decisions/0000-decision-log.md` (registry row)
- `docs/plans/PLAN-join-auth-prefetch-loop-fixes.md`
- `docs/journeys/JOURNEY-join-auth-prefetch-loop-fixes.md`

## Learnings

### L-NEW (proposed) — Supabase server `getSession()` is NOT refresh-safe

`@supabase/ssr` `createServerClient` sets `autoRefreshToken: false`, which suggests `getSession()` reads the cookie without rotation. **It does not.** `GoTrueClient.__loadSession` (`src/GoTrueClient.ts:1138-1160`) still triggers `_callRefreshToken` on expiry; the `autoRefreshToken: false` flag only disables the background timer (`_recoverAndRefresh` at L1941). For Server Actions, use `getUser()` directly. First learned during this sortie's G1 reconciliation after Track A architecture review.

**Repeat-trap class:** "framework flag suggests one behaviour, implementation is broader." Sibling to L-0176 (capability tool docstrings claiming ADR compliance ahead of body).

### L-NEW (proposed) — parallel auth-token store on wizard state is an anti-pattern

The `_accessToken` field was added as a defensive workaround for "cookies may not be available to the Server Action in the same request cycle after signUp." Real cause: client auto-rotates refresh tokens, parallel store goes stale, server fallback uses stale token and fails. ADR-0357 codifies cookies as single source of truth.

**Sibling pattern:** L-0177 (silent fallback to JWT-default workspace when row-not-found). Same class — "convenience parallel state path that masked a race."

### L-NEW (proposed) — turbo cache must be `--force`d in fresh worktrees

`pnpm turbo build --filter='@smartout/*'` in `~/wsl/smartout.ai-wt-1` replayed dist artifacts from other worktree paths (`smartout.ai-payroll`, `smartout.ai-wt-3`). Build succeeded but `wt-1/node_modules/@smartout/*/dist/` symlinks pointed to stale paths. Fix: `--force`. Already L-turbo-cache-cross-worktree in MEMORY.md — confirmed 2026-05-18.

## Known issues / debt

| Item | Severity | Status |
|---|---|---|
| Journey 2 (expired-session restore from localStorage) still throws 500 with `Not authenticated`; no UX rescue path | medium | Follow-up sortie. Acknowledged in plan §"Out of scope" + journey body. |
| `NEXT_PUBLIC_ROOT_DOMAIN` not asserted prod-only in `packages/supabase/src/{client,server}.ts` — undefined env produces client/server cookie-domain drift that recreates the race | low (env is set in prod) | Follow-up sortie. Flagged by Track A architecture review §E. |
| Multi-tab concurrent rotation (two tabs run Supabase client side-by-side) leaves a ~ms race window | low | Documented in journey §"Known residual"; if tickets land, switch `createBrowserClient` to use `lockManager` / `_acquireLock` options. |

## Next steps

| Owner | Step | When |
|---|---|---|
| Pontus | Smoke `/join` from wt-1 — see checklist below | Before close |
| Lead agent | `close-feature.sh 1` → merge to `development` | After smoke green |
| Pontus | `promote-preview` (HOP A) | After QA on `development` |

## Smoke checklist (operator)

Run from `/home/sxtnl/wsl/smartout.ai-wt-1`. Existing dev server on 3060 may be serving the main repo — stop it first.

```bash
tmux new -s smartout.ai-1 -n "wt-1:join-auth-prefetch-loop-fixes" -c /home/sxtnl/wsl/smartout.ai-wt-1
op run --env-file=.env.template -- pnpm run dev
```

Then in browser at `http://127.0.0.1:3060/join`:

| # | Step | Expected | Pass/Fail |
|---|---|---|---|
| 1 | Type `Strøm Mat & Bar` + `Skien` on Step 1. Watch DevTools Network. | `/api/scrape/brreg` fires 1x within 800ms after typing stops. Re-typing same value does NOT re-fire. | ⬜ |
| 2 | Fill email + password (test1234) + confirm + names. Blur confirm-password. | Console: silent signUp succeeds (or signIn fallback on existing email). No `_accessToken` set in localStorage `JOIN_STORAGE_KEY` | ⬜ |
| 3 | Click through to Step 5. | Cuisine chips, restaurant-type select, price select, menu description textarea ALL pre-filled. "✨ AI-foreslått" badge visible. | ⬜ |
| 4 | Click "Fullfør" on Step 6. | Browser console clean. Network: POST `/join` returns 200/303. Redirect to `/onboarding/{workspaceId}`. | ⬜ |
| 5 | Optional Journey 3 stress: idle on Step 3 for 6 min, then submit. | Same 200/303 result. No `refresh_token_already_used` in console. | ⬜ |

Report green count to lead agent. Anything red → diagnose before close.

## E2E recommendation (not blocking)

Three Playwright specs map 1:1 to the journeys above. Existing specs in `apps/e2e/tests/join-*.spec.ts` cover happy path but don't yet assert BRREG call count or Step 5 prepopulate state. Worth a follow-up sortie to add:
- `join-step5-prepopulate.spec.ts` — assert `intel.llm_cuisine_types` non-empty in localStorage after Step 1 → Step 5 transition
- `join-brreg-dedupe.spec.ts` — count network requests, assert ≤ 1 per stable tuple
- `join-auth-no-race.spec.ts` — use `page.context().clock` to advance time 6 min between steps, assert submit returns 200

## Verification artifacts

| Gate | Result |
|---|---|
| G1 (review reconcile) | Tracks A/B/C: APPROVE-WITH-CHANGES — all patches applied per G1 list |
| G3 (`tsc --noEmit` on apps/web) | exit 0 (post turbo `--force` rebuild) |
| G6 (smoke) | OPERATOR — checklist above |
| G5 (`local-ci-before-pr`) | Pending — runs at close-feature.sh |
