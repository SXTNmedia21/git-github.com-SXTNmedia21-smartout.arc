---
title: "PLAN — join-expired-session-rescue"
status: done
updated: 2026-05-18
created: 2026-05-18
module: onboarding
tags: [plan, join, auth, session, wizard]
---

# PLAN — join-expired-session-rescue

> Branch: `feat/join-expired-session-rescue` | Worktree: /home/sxtnl/dev/smartout.ai-wt-1 | Base: `development` | Module: onboarding | Started: 2026-05-18

## Goal

Eliminate the 500 "Not authenticated" error that occurs when a user returns to /join after
their Supabase session cookie has expired, and redirect them to /login for re-auth with
automatic resume at Step 6 Summary after successful login.

## Root Cause

Journey 2 in `JOURNEY-join-auth-prefetch-loop-fixes.md` documented this as a known residual:
"Follow-up sortie can add UX rescue." This is that follow-up sortie.

Two distinct failure modes existed:
1. **Load-time:** Wizard hydrates with localStorage data; user is already unauthenticated. `ExpiredSessionGate` now catches this.
2. **Submit-time:** Session expired during wizard fill. `completeSignup` discriminated result catches this.

See: ADR-0358 (`docs/decisions/0358-join-expired-session-rescue.md`)

## Tasks

- [x] Phase 1 — `validateReturnTo` utility at `apps/web/src/lib/safe-redirect.ts`
- [x] Phase 2 — `apps/web/src/app/join/_lib/storage.ts` (saveJoinState / loadJoinState / clearJoinState)
- [x] Phase 2 — `JOIN_STORAGE_TTL_MS` + `JOIN_STORAGE_SCHEMA_VERSION` constants in `types.ts`
- [x] Phase 2 — `wizard-definition.ts` migrated to storage module
- [x] Phase 3 — `CompleteSignupResult` discriminated union in `setupActions.ts`
- [x] Phase 3 — `completeSignup` return type updated; throws replaced by discriminated returns
- [x] Phase 4 — `login/page.tsx`: `useSearchParams`, `validateReturnTo`, `returnTo` push, expired banner
- [x] Phase 5 — `ExpiredSessionGate` component (`_components/ExpiredSessionGate.tsx`)
- [x] Phase 5 — `ExpiredSessionGate` wired into `join/page.tsx`
- [x] Phase 6 — `join.session_expired_rescued` + `join.session_expired_at_submit` in registry (ADR-0112: same commit)
- [x] Phase 6 — Emit call-sites in `ExpiredSessionGate.tsx` and `wizard-definition.ts`
- [x] Phase 7 — `docs/decisions/0358-join-expired-session-rescue.md`
- [x] Phase 7 — ADR-0358 registered in `docs/decisions/0000-decision-log.md`
- [x] Phase 7 — `docs/journeys/JOURNEY-join-expired-session-rescue.md`
- [x] Phase 7 — This plan file

## Acceptance Criteria

- [x] Typecheck passes: `pnpm turbo typecheck`
- [x] Decision log updated (ADR-0358)
- [x] User journeys written (3 journeys)
- [x] `completeSignup` returns discriminated result instead of throwing on session_expired
- [x] `validateReturnTo` rejects absolute URLs, protocol-relative paths, backslashes, out-of-allowlist paths
- [x] `join.session_expired_rescued` + `join.session_expired_at_submit` in EVENT_ROUTING
- [x] Envelope schema version + TTL purge prevents stale data loading

## Out of Scope

- OAuth `/api/auth/callback?next=` safe-redirect parity (F1 constraint)
- Resume to exact wizard step (F1 always resumes at Step 6 Summary)
- Multi-tab concurrent token rotation (documented residual in ADR-0357)
- E2E Playwright tests (recommended, not required for F1 closure)
