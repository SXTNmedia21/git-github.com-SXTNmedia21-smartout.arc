---
title: Handoff — auth-security-friction
feature: auth-security-friction
branch: feat/auth-security-friction
closed: 2026-03-30
module: auth
---

# Handoff — auth-security-friction

## Summary

Rebuilt the auth flow to eliminate friction from the Join wizard and harden security across the platform. Auth moved from wizard step 6 to step 1 (silent signUp), OTP added as login method, sandbox lifecycle for unverified workspaces, three-layer rate limiting, and automated cleanup of abandoned sandboxes.

## What Was Done

- [x] Database migrations: workspace_status enum + engine FK CASCADE
- [x] Supabase config hardening: rate limits, password length, OTP settings
- [x] Telemetry: 12 new events (auth OTP, security, enrichment categories)
- [x] Silent auth in Join wizard step 1 (password fields + signUp on blur)
- [x] Step 6 converted from account creation to summary/review
- [x] Shared OTP verification component (6-digit, auto-advance, paste, a11y)
- [x] Verification gate overlay on dashboard for unverified users
- [x] OTP login method on login page (tab switching)
- [x] Rate limiting: OTP (3/15min), workspace-create (3/hour), fail-closed auth
- [x] Middleware sandbox enforcement (blocked routes + 30s cache)
- [x] Sandbox cleanup Edge Function (cron-triggered, CASCADE + orphan user deletion)
- [x] Auth security protocol documentation
- [x] database.types.ts corruption fix (npm warnings prepended)

## Decisions Made

| Decision                              | Reason                                                                                         | Impact                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Silent signUp in step 1               | Removes visible auth friction — user enters password alongside basic info                      | Auth is invisible, session available from step 2 onward                                            |
| workspace_status enum                 | Replaces ad-hoc status tracking, enables sandbox lifecycle                                     | All workspaces start as sandbox, activate on verification                                          |
| email_confirmed_at as source of truth | Supabase Auth already tracks this — no custom column needed                                    | VerificationGate checks auth.users, not workspace table                                            |
| Fail-closed rate limiting             | Security over availability — if Redis is down, block auth rather than allow unlimited attempts | Auth requests blocked when Redis unavailable                                                       |
| OTP never reveals email existence     | Security best practice — "Hvis denne e-posten finnes..." regardless of whether email exists    | Prevents email enumeration attacks                                                                 |
| Engine FK CASCADE                     | Sandbox cleanup deletes workspace — engine tables must CASCADE to avoid FK violations          | engine_sessions, engine_memory, engine_authority_config, engine_inbox, engine_missions all CASCADE |
| 30s middleware cache                  | Same pattern as godmode cache — avoids per-request DB lookups for sandbox status               | Max 30s stale data (acceptable for route blocking)                                                 |

## Learnings

| Learning                                                                  | Context                                                                           |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `cn` utility is at `@/lib/utils`, not `@smartout/ui/lib/utils`            | Subagents used wrong import path — caught by typecheck pre-push hook              |
| database.types.ts can get corrupted by npx supabase gen types             | npm warnings and WARN lines get prepended to the file, breaking TS compilation    |
| Supabase signUp returns `{ user: { identities: [] } }` for existing users | TypeScript narrows signUpData to `never` after error branch — needs explicit cast |
| pnpm install needed in package dirs for worktree typecheck                | notifications package had missing node_modules, blocking pre-push hook            |
| lint-staged can pull in unrelated staged files from other tasks           | Parallel subagents staging files can cause cross-contamination in commits         |

## Known Issues / Debt

- `Step6CreateAccount.tsx` remains in repo (unreferenced) — should be deleted in cleanup PR
- `packages/website` has pre-existing typecheck errors (missing zod) — unrelated to this feature
- Sandbox cleanup cron schedule not yet configured in production — needs Supabase dashboard setup
- Login page currently broken on development (pre-existing, not caused by this feature)
- EmmaProfile.tsx and emma-arena spec have uncommitted changes in wt-8 (from different feature)

## Next Steps

- Configure sandbox cleanup cron in Supabase dashboard (recommended: `0 3 * * *`)
- Delete `Step6CreateAccount.tsx` in cleanup PR
- Add E2E tests for join wizard with silent auth flow
- Add E2E tests for OTP login method
- Implement L3 telemetry anomaly detection (security rate_limited alert → Slack)
- Add suspended/archived workspace status handling in middleware
