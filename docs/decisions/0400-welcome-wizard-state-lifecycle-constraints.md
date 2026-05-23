---
id: 0400
title: "Welcome Wizard State Lifecycle Constraints"
status: accepted
date: 2026-05-23
deciders: pontus + council R3 (employee-onboarding-wizard post-impl)
tags: [adr, wizard, onboarding, lifecycle, telemetry, constraints]
supersedes: []
amends: []
---

# ADR-0400 — Welcome Wizard State Lifecycle Constraints

## Context

R3 post-impl council uncovered four interacting defects in the wizard's state lifecycle that all stemmed from undocumented assumptions:

1. `employee_onboarding_state.dismissed_at` was set on dismiss but never cleared, even after resume or completion — violating `eos_dismissed_iff_ts CHECK ((status='dismissed') = (dismissed_at IS NOT NULL))` whenever a user dismissed then completed.
2. Both state GET routes used `.upsert(..., { ignoreDuplicates: true }).select(...).single()` — PostgREST returns ZERO rows on conflict + `.single()` throws PGRST116. Affects every GET after the first.
3. `recordWelcomeResume` fired on every GET while `dismissed_at IS NOT NULL && completed_at IS NULL` — telemetry amplification.
4. Mobile `(app)/_layout` checked only `profile.is_welcome_complete === false` and not `employee_onboarding_state.dismissed_at` — dismissed users got force-redirected on every cold start.

Root cause: nowhere was the state-row lifecycle codified. The wizard had two sources of truth (`profile.is_welcome_complete` denormalized flag + `employee_onboarding_state` row) without an ADR explaining their relationship, and the dismiss/resume/complete transitions had no documented invariant for which timestamp columns must reset.

## Decision

Codify the following invariants:

### 1. State-row coherence

`employee_onboarding_state` is the canonical truth. `profile.is_welcome_complete` is a denormalized read-fast flag for fast `/dashboard` redirect-gate decisions. The two are kept in sync by `completeWelcome`.

Allowed `(status, dismissed_at, completed_at)` tuples:
- `('in_progress', NULL, NULL)` — initial state or post-resume
- `('dismissed', T, NULL)` — user dismissed at T
- `('completed', NULL, T)` — user completed at T

ANY other combination violates `eos_dismissed_iff_ts` or `eos_completed_iff_ts` CHECK constraints. Server actions writing to this table MUST explicitly enumerate the affected timestamp columns — partial upserts that omit a transition-target column = bug.

### 2. Transition rules

- `dismiss`: status `in_progress | completed` → `dismissed`. Set `dismissed_at = now`, leave `completed_at` untouched (only completed→dismissed is unusual; in_progress→dismissed is the common path).
- `resume` (via `recordWelcomeResume`): status `dismissed` → `in_progress`. Set `dismissed_at = NULL`. Idempotent — guard with `WHERE status='dismissed'` so subsequent calls are no-op.
- `complete`: status `in_progress | dismissed` → `completed`. Set `completed_at = now`, set `dismissed_at = NULL` (always — covers the dismiss→resume→complete and dismiss→complete-direct paths).

### 3. Lazy-create pattern (CRITICAL — bundler-undetectable trap)

NEVER use `.upsert(..., { ignoreDuplicates: true }).select(...).single()` to lazy-create-then-read a row. PostgREST semantics: `ignoreDuplicates:true` skips the RETURNING clause for the conflict path, so `.single()` sees zero rows on existing-row case → PGRST116 → 500.

Correct patterns:
- (a) `.upsert(..., { ignoreDuplicates: false })` — safe if the upsert payload only contains PK/FK columns that are immutable on conflict (no risk of overwriting other fields).
- (b) Split: `.select(...).maybeSingle()` first; if null, `.insert(...)` then `.select(...).single()`.

### 4. Telemetry amplification gate

`welcome_wizard_resumed` emit fires AT MOST ONCE per dismiss-event. The transition (Rule 2) clears `dismissed_at` simultaneously with the emit, making the GET-handler gate `dismissed_at IS NOT NULL && completed_at IS NULL` self-disarming.

### 5. Document-version constants single-source

Web Server Action + mobile BFF MUST import consent `document_version` values from the same module (`apps/web/src/app/dashboard/_actions/welcome-wizard-constants.ts`). Hardcoding in either surface = silent audit-trail drift when one bumps the version.

## Enforcement

1. Migration `20260624000100_create_employee_onboarding_state.sql` already enforces the CHECK constraints. They surface violations at INSERT/UPDATE time as Postgres errors — no app-level guard needed for invariant violation per se.
2. Server actions touching `employee_onboarding_state` MUST be reviewed against this ADR. No mechanical guard exists (would require AST-level analysis of upsert payloads). Code review + post-impl council are the gate.
3. Lazy-create pattern (Rule 3): no mechanical guard. Hard rule documented in `smartout-database-guide` skill (sibling section to RLS dual-auth + typegen drift entries).
4. Document-version constants (Rule 5): no ESLint rule yet (next sortie). For now: reviewer grep for `"handbook-v\\d"`, `"gdpr-v\\d"`, `"tariff-v\\d"` literals outside `welcome-wizard-constants.ts` at PR-review time.

## Consequences

- All existing transition code paths now have a documented invariant — drift becomes obvious in review.
- `recordWelcomeResume` becomes the canonical state-clearing point; future features can trust that GET handlers don't double-emit.
- Future tables with biconditional CHECK constraints (status enum + timestamp column pairs) inherit the same Rule 2 pattern.
- Future lazy-create patterns must follow Rule 3 — no silent PGRST116 traps.

## References

- Council R3 (2026-05-23): `docs/council/COUNCIL-LOG.md`
- Migration: `supabase/migrations/20260624000100_create_employee_onboarding_state.sql`
- Server actions: `apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts`
- BFF routes: `apps/web/src/app/api/employee-onboarding/state/*` + `apps/web/src/app/api/mobile/employee-onboarding/state/*` + `save-step/route.ts`
- L-0333 (lazy-create PGRST116 trap)
- L-0334 (biconditional CHECK constraint coherence)
- L-0335 (mirror-tables document-version drift)
- L-0336 (Phase 8 site-map gate misses mounted Dialogs)
- L-0337 (journey verified-flag premature toggle)
- ADR-0396 (identity columns on user_identity — sibling)
- ADR-0397 (Strategy A wizard architecture — superseded structure preserved)
