---
title: "Forward-only repair for timestamp-collision migration class"
id: ADR_0427
status: accepted
layer: decision
created: 2026-05-25
updated: 2026-05-25
---

# ADR-0427: Forward-only repair for timestamp-collision migration class

## Context and Problem Statement

Two parallel branches (cloud/main + development) authored migrations with overlapping `YYYYMMDDhhmmss` timestamps but different SQL bodies. When cloud/main flowed to main via PR-merge and prod-deploy, prod ledger recorded the cloud/main timestamps as applied. The development-side migrations at the SAME timestamps (different SQL) were silently skipped by `supabase db push --include-all` on subsequent main pushes — the CLI matches by timestamp, not content. This left development with constraint extensions (ADR-0410 godmode `'godmode'` source/actor_kind) that COULD NEVER deploy to prod, even though local dev DB had them applied.

Same root-cause family as L-0302 (ledger-recorded-without-DDL) but distinct mechanism: collision-aliasing rather than ghost-application.

## Decision Drivers

- ADR-0361 §Design 2 (2026-05-17) codifies "Forward-only repair, not auto-fix" — established doctrine for ghost-class migrations
- ADR-0265 §Hard rules ban manual prod DDL touches except for emergency rollback (Edge Function carve-out only)
- L-0302 documented the ghost class but didn't anticipate timestamp-collision-aliasing as a distinct sub-class
- `supabase db push --include-all` is atomic per migration but timestamp-keyed, not content-keyed
- Prod migration coherence detector (`.github/workflows/ci.yml:495-520`) flags drift but does not auto-resolve

## Considered Options

1. **Option A — Direct DDL via MCP `execute_sql`** — instant fix but normalizes manual prod touches, violates ADR-0265 §Hard rules, sets precedent that future ghost-recovery skips CI.
2. **Option B — Manual DML on prod `schema_migrations` ledger** — delete colliding rows then `db push --include-all` re-applies. Still requires manual prod touch; same blast surface as A.
3. **Option B′ — `supabase migration repair --status reverted` CLI** — sanctioned tooling for ledger mutation but supersedes by ADR-0361 §Design 2 (2026-05-17 doctrine shift).
4. **Option C — Wait for next HOP B, do nothing** — non-viable; `db push --include-all` skips collision-aliased migrations forever.
5. **Option D — Forward-only idempotent migration at NEW unique timestamp** — bundles all 3 godmode constraint extensions, uses `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`, deploys cleanly through normal CI on next HOP B.

## Decision Outcome

Chosen option: **"Option D — Forward-only idempotent migration"**, because it (a) routes through the canonical pipeline per ADR-0265, (b) aligns with ADR-0361 §Design 2 forward-only mandate, (c) is cause-agnostic via idempotency, (d) leaves a code trail for future operators, (e) costs only ~30 minutes of HOP B latency in exchange for not normalizing manual prod touches.

Concrete artifact: `supabase/migrations/20260626000300_repair_godmode_constraints_collision_recovery.sql` (commit `613b7b09f`). Three idempotent `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` operations covering:
- `profile.profile_source_check` → accepts `'godmode'`
- `activity_trail.activity_trail_actor_kind_check` → accepts `'godmode'`
- `activity_trail.activity_trail_user_actor_fields_required` → composite OR-branch for godmode (actor_id NULL allowed)

## Rules & Consequences

- **Good, because** ledger-collision class now has a codified recovery pattern in addition to L-0302's ghost-DDL class. Council Phase 8 capture rule satisfied.
- **Good, because** preserves ADR-0265 hard rules — no manual prod DDL touch normalized.
- **Bad, because** introduces a small recurring cost: every collision-recovery requires a new sortie + ADR amendment cite, even though the underlying SQL is mechanical.
- **Bad, because** does not prevent the COLLISION itself — that requires a separate mechanism (timestamp-collision pre-flight in `close-feature.sh`, or pull-from-main gate before merging hotfix branches).
- **Agent Impact:** When orchestrator detects a migration-timestamp collision between local branch and origin/main (or origin/preview), use this ADR's pattern:
  1. Delete the colliding dev-only migration files (no longer have unique timestamps)
  2. Author a NEW migration with `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` (or equivalent idempotent shape) at a timestamp strictly greater than the latest main migration tip
  3. Bundle all affected constraint/function changes in one file to minimize the CI roundtrip
  4. Reference this ADR in the migration header comment

## Predecessor / Sibling References

- ADR-0361 §Design 2 (2026-05-17) — forward-only repair, not auto-fix (this ADR is the extension to collision-aliasing sub-class)
- ADR-0265 — Enforced Deployment Pipeline (the rule this ADR protects)
- ADR-0410 — Godmode Workspace Auto-Join (the originating sortie that triggered the discovery)
- L-0302 — Ghost migration from reconciliation (sibling root-cause family)
- L-0042 — Migration timestamp ordering (related but distinct — out-of-order push vs collision)
- L-0358 (this council) — Forward-only doctrine extended to collision-aliasing
- L-0359 (this council) — Phase 2.5 fact-check must search docs/decisions/ for doctrine ADRs (3rd occurrence, promotion-grade)
- L-0360 (this council) — L-0147 13th precedent (Phase 1 Option A → Phase 5 Option D reversal)

---

> Registered in `docs/decisions/0000-decision-log.md`. Council session 2026-05-25 verdict APPROVED Option D with 4 conditions; sortie deferred for Conditions 1-2 (audit + baseline regen) since sync-with-main consumed the same budget. Condition 3 (this ADR) fulfilled here. Condition 4 (code-consumer audit) executed in sync sortie, clean.
