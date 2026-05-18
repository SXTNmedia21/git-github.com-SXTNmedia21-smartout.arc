---
title: "Handoff — join-expired-session-rescue"
status: done
updated: 2026-05-18
created: 2026-05-18
module: onboarding
tags: [handoff, join, wizard, auth, supabase, expired-session]
---

# Handoff — join-expired-session-rescue

> Branch: `feat/join-expired-session-rescue` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-1` | Base: `development` @ 957b04fd5 (F0 close)

## Summary

Closes the only known 500 path remaining on `/join` after F0 (ADR-0357): Journey 2 — expired-session restore. User returns to `/join` with localStorage wizard state from a 30-min-old session. Pre-fix: clicks Fullfør on Step 6 → Server Action throws `Not authenticated` → 500 to user, no recovery. Post-fix: load-time gate or submit-time discriminated result → redirect `/login?return_to=/join&reason=expired` → after re-auth, wizard resumes on Step 6 Summary with all data intact.

## Decisions made

| ID | Decision | Where |
|---|---|---|
| ADR-0358 | Recoverable expired-session handoff for /join: discriminated `CompleteSignupResult`, client-side `<ExpiredSessionGate>` + submit-time fallback, validated `return_to` query param, `/login` honors it | `docs/decisions/0358-join-expired-session-rescue.md` |

Implementation pattern codified:
- **Server Action** returns discriminated union — `{ ok: true, ... } | { ok: false, reason: 'session_expired' | 'system_error', message? }`. `throw` reserved for unrecoverable infra. Auth errors classified by `authErr.code` allowlist (`session_not_found`, `bad_jwt`, `refresh_token_not_found`, `refresh_token_already_used`, `user_not_found`), NOT blanket null user — protects against transient outage misclassification.
- **Detection** at two points: (a) `<ExpiredSessionGate>` on /join load when localStorage envelope exists + `getUser()` returns null; (b) Server Action result on submit.
- **localStorage envelope** versioned + TTL'd: `{ schemaVersion: 1, savedAt, state }`. 24h TTL purges stale resume. Cleared only after `ok: true`.
- **return_to allowlist:** `/join`, `/onboarding`, `/dashboard` prefixes. Centralized validator at `apps/web/src/lib/safe-redirect.ts`.
- **Resume granularity:** wizard `_initialStepIndex` injected from highest-completed step at load time, so user lands on Step 6 Summary post-login (not Step 1).
- **Telemetry:** two new events `join.session_expired_rescued` + `join.session_expired_at_submit`. Per ADR-0112, registered in same commit as emit-sites. `BaseEvent.actor_id` widened to `NonEmptyString | null` for these pre-auth events (no L-0177 sentinel strings).

## What was built

### Files (13 + G1 cascade)

**Initial commit set:**
| File | Status | Bug |
|---|---|---|
| `apps/web/src/lib/safe-redirect.ts` | NEW | shared validator |
| `apps/web/src/app/join/_lib/storage.ts` | NEW | envelope with TTL/schema |
| `apps/web/src/app/join/_components/ExpiredSessionGate.tsx` | NEW | load-time detection |
| `apps/web/src/app/join/page.tsx` | EDIT | wire gate |
| `apps/web/src/app/join/types.ts` | EDIT | TTL + schema constants |
| `apps/web/src/app/join/_lib/setupActions.ts` | EDIT | discriminated result |
| `apps/web/src/app/join/wizard-definition.ts` | EDIT | storage helpers + result branching + _initialStepIndex injection |
| `apps/web/src/app/login/page.tsx` | EDIT | honor return_to + reason=expired banner |
| `packages/telemetry/src/registry.ts` | EDIT | 2 new events + BaseEvent widening |
| `packages/telemetry/src/providers/logger.ts` | EDIT (cascade) | LogEntry.actor_id nullable |
| `packages/telemetry/src/providers/posthog.ts` | EDIT (cascade) | distinctId fallback for null actor |
| `docs/decisions/0358-join-expired-session-rescue.md` | NEW | ADR |
| `docs/decisions/0000-decision-log.md` | EDIT | register ADR-0358 |
| `docs/journeys/JOURNEY-join-expired-session-rescue.md` | NEW | 3 journeys |
| `docs/plans/PLAN-join-expired-session-rescue.md` | NEW | plan |

## Learnings

### L-NEW — Supabase auth-error classification matters for UX recovery

A null user from `supabase.auth.getUser()` server-side can mean (a) cookies expired (auth-recoverable, redirect to /login) OR (b) network error / Supabase 5xx (system-recoverable, retry). Blanket-classifying as `session_expired` silently redirects every visitor to /login during transient outages. Fix: explicit `authErr.code` allowlist. Found by Track A.

### L-NEW — BaseEvent.actor_id needs nullable variant for pre-auth surfaces

Public surfaces like `/join` emit telemetry events BEFORE user identity is resolved. Storing string sentinels like `"anonymous"` in `actor_id` violates L-0177 (silent fallback class). Cleaner: widen `BaseEvent.actor_id` to `NonEmptyString | null`. Required cascade fixes to logger + posthog providers (posthog now falls back to "anonymous" only at the API boundary, never in our data model). Found by Track A.

### L-NEW — Wizard step resume needs explicit `_initialStepIndex` injection

`useWizardState.ts` reads `_initialStepIndex` from saved state to set the starting step. The storage envelope must inject this field at load time based on which step-keys are filled — otherwise the wizard always starts on Step 1 even when all steps are pre-filled. Architect-intent vs implementation gap. Found by Track A.

### L-NEW — turbo cache replay class confirmed again

Each new sortie requires `pnpm turbo build --filter='@smartout/*' --force` after `pnpm install`. Without `--force`, builds replay from sibling-worktree dist paths. Already L-turbo-cache-cross-worktree in MEMORY.md — confirmed third sortie in a row.

## Known issues / debt

| Item | Severity | Status |
|---|---|---|
| OAuth callback `/api/auth/callback?next=` does not honor `return_to` validator. Google-OAuth `/login → /dashboard` path is unaffected, but a future user who lands at `/join` and clicks Google to re-auth would not return to `/join` post-OAuth. | low | Explicit follow-up. ADR-0358 §"Out of scope". Filing as **F-OAUTH-RETURN-TO** sortie. |
| `setupActions` system_error message is generic ("Auth lookup failed. Please try again."). Operator may want to log richer detail for analytics without leaking to client — but `console.error` already preserves it server-side. | low | No action; design is correct. |
| Multi-tab concurrent rotation residual carried over from ADR-0357. Tab A submits, Tab B's gate fires. Documented as known residual. | low | No action — same as F0 doc. |
| E2E spec for Journey 2 — not written in this sortie. F3 follow-up sortie (`feat/e2e-join-suite-refresh`) covers the full join spec rewrite including this journey. | medium | Queued |
| Builder-reported pre-existing `tsc` errors on @smartout/types / @smartout/contracts in fresh worktrees — resolved via turbo `--force` rebuild. Already in MEMORY.md as L-stale-telemetry-dist class. | low | Documented |

## Next steps

| Owner | Step | When |
|---|---|---|
| Pontus | Smoke per checklist (3-step manual or wait F3 E2E) | Before promote-preview |
| Lead agent | F2 `feat/supabase-root-domain-assert` (small, queued) | Next sortie |
| Lead agent | F3 `feat/e2e-join-suite-refresh` (medium, queued — covers Journey 2 spec) | After F2 |
| Pontus | Decide F-OAUTH-RETURN-TO priority | Backlog |

## Smoke checklist (operator)

Run from `/home/sxtnl/dev/smartout.ai-wt-1` after starting dev:

```bash
op run --env-file=.env.template -- pnpm --filter web dev
```

In browser at `http://127.0.0.1:3060/join`:

| # | Scenario | Expected |
|---|---|---|
| 1 | Fresh visitor (no localStorage) | Wizard loads on Step 1. ExpiredSessionGate no-op. No console errors. |
| 2 | Fill Step 1 silentAuth, close tab, wait 24h+, return | localStorage envelope auto-purged on load (TTL hit). Wizard starts fresh Step 1. |
| 3 | Fill Steps 1-5, close tab, return within 24h with expired cookies | Gate detects: redirect to `/login?return_to=/join&reason=expired`. Banner shows. After login, lands on Step 6 Summary with all data filled. |
| 4 | Reach Step 6, click Fullfør while session has just rotated multi-tab → server returns `session_expired` | Same `/login` redirect path via submit-time branch. Resume to Step 6. |
| 5 | Reach Step 6, click Fullfør during simulated Supabase outage | `system_error` toast: "Auth lookup failed. Please try again." User stays on Step 6. No `/login` redirect. |
| 6 | Return-to validation: navigate to `/login?return_to=//evil.com` | Validator rejects → falls back to `/dashboard` after login. |

## Verification artifacts

| Gate | Result |
|---|---|
| G-D (D1 architecture + D2 mapping) | ✓ both delivered, all 4 open Qs orchestrator-resolved (no council) |
| G-B (builder applies architecture) | ✓ 13 files / +164 -53 / typecheck exit 0 |
| G-R (review triplet A+R+S) | ✓ APPROVE-WITH-CHANGES from all three; R2 single-slash claim false; 6 G1 patches applied |
| G-T (post-G1 typecheck) | ✓ `tsc --noEmit` exit 0 after turbo `--force` rebuild |
| G-E (E2E) | DEFERRED to F3 sortie |
| G-CI (ci:local) | TBD — runs at close |
| G-CLOSE | TBD — bypass tolerated for same pre-existing infra flakes as F0 |
