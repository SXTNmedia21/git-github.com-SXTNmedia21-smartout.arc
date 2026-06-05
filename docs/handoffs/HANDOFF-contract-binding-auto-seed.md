---
title: "HANDOFF — feat/contract-binding-auto-seed"
status: ready-to-close
updated: 2026-05-06
created: 2026-05-06
module: contract
linear: SMA-309
tags: [handoff, contract, supabase, migration, onboarding-blocker]
---

# HANDOFF — feat/contract-binding-auto-seed

> Branch: `feat/contract-binding-auto-seed`
> Base: `development`
> Worktree: `~/wsl/smartout.ai-wt-6`
> Commits: `b31dfe402` (plan + journey), `a16d8a5fd` (migration + plan correction)
> Linear: **SMA-309** (closed by this sortie)

## Summary

Closed the "fresh workspace = 400 on first contract" failure mode (SMA-309). Auto-seeds `workspace_framework_binding` on every `workspace` INSERT via SECURITY DEFINER trigger. Backfilled 1 existing workspace. Idempotent self-test confirms zero orphan workspaces post-migration.

Single-file migration. Mirrors `workspace_seed_authority_defaults_trg` pattern (ADR-0192). No app code changes.

## Decisions

| Decision | Reason |
|---|---|
| Hardcode framework code `hospitality.no.default.v1` (NOT industry-aware) | All current customers are hospitality. Industry-aware lookup requires niche derivation (separate Linear ticket). Fail-closed: if framework missing, trigger logs RAISE NOTICE + skips, workspace insert succeeds, first contract send still 400s with same error as today (no regression). |
| SECURITY DEFINER + `SET search_path = public, extensions` | L-0172 hard rule: trigger doing cross-table SELECT without locked search_path = silent RLS bypass risk. Mirrors authority_seed_defaults_trg shape. |
| Coexistence with `bootstrap-cascade` EF (not removal) | EF uses `ignoreDuplicates: true` upsert. After trigger lands, EF sees existing row, no-ops. Idempotent. Removing EF code would scope-creep into onboarding-flow refactor. |
| Telemetry deferred to separate ticket | SQL trigger cannot call TypeScript `emit()`. Three options (EF post-trigger emit, audit_trail direct DB INSERT, skip telemetry) require design decision out of scope for SMA-309. |
| Falsifiable self-test (Part D) instead of pgTAP file | Self-test runs at apply time and FAILS the migration if any workspace remains orphan. pgTAP file would be optional; in-migration assertion is mandatory. Tighter feedback loop. |
| Backfill via `NOT EXISTS` + `ON CONFLICT DO NOTHING` | Doubly-idempotent. Safe to re-run migration. Targets ONLY workspaces missing active binding — does not disturb workspaces already bound (incl. bootstrap-cascade-seeded ones). |

## Learnings

| L# | Learning |
|---|---|
| L1 | **Plan-text codes drift from real schema.** Plan said `riksavtalen_hospitality_2024`; real K1a code is `hospitality.no.default.v1`. Plan said column `bound_at`; real column is `activated_at`. Architect-verify caught both before SQL was written. Lesson: code-architect Phase 1 design-verify pre-flight is non-negotiable for SQL migrations. |
| L2 | **`finalize-workspace` EF doesn't seed binding.** The auto-seed today happens in `bootstrap-cascade` EF, called only from `/onboarding` (legacy) wizard, NOT `/join` (current). Two onboarding paths = two seed paths in Edge Functions = some workspaces missed. DB trigger is the correct level — guarantees coverage regardless of EF call site. |
| L3 | **SQL trigger ≠ TS telemetry.** Triggers fire at DB level; `emit()` lives in TypeScript. Bridging requires either (a) emit from EF after observing trigger fired, (b) direct INSERT into `activity_trail` from trigger, or (c) skip telemetry. Decided (c) for SMA-309, (a) tracked separately. Lesson: `workspace.framework_binding_auto_seeded` event design needs telemetry-bridge ADR before implementation. |
| L4 | **`npx supabase migration up` failed** because local DB had a remote migration `20260526000000` not in worktree on-disk. Workaround: applied migration via `docker exec -i supabase_db_smartout.ai psql ... < migration.sql`. Lesson: when worktree is behind another worktree's local applies, direct psql apply is the safe path; supabase CLI migration-history check is too strict. |
| L5 | **`bootstrap-cascade` EF is the canonical-existing seeder.** Not `finalize-workspace`. Verified by reading EF source, not docs. Plan/Map referenced wrong EF. Lesson: when verifying "where is X seeded today", grep code for `INSERT INTO X`, never trust docs alone. |
| L6 | **`hospitality.no.default.v1` is seeded by TWO migrations** (`20260422400100`, `20260424100000`). Both use `ON CONFLICT (code)` so idempotent. Architecturally one would suffice; duplication is benign. Lesson: K1a seed migrations sometimes get re-emitted across sortie cycles — verify via `SELECT COUNT(*) FROM regulatory_framework WHERE code = 'X'` before adding a third. |

## What was built

### Migration

| File | Change |
|---|---|
| `supabase/migrations/20260525120000_workspace_framework_binding_auto_seed.sql` | NEW — 4 parts: function, trigger, idempotent backfill, falsifiable self-test |

### Docs

| File | Change |
|---|---|
| `docs/plans/PLAN-contract-binding-auto-seed.md` | Plan + architect verdict + Phase 2 scope-cut |
| `docs/journeys/JOURNEY-contract-binding-auto-seed.md` | NEW — single journey: fresh workspace → first contract |
| `docs/HANDOFF-contract-binding-auto-seed.md` | This file |

## Verification log

### Local apply

```
$ docker exec -i supabase_db_smartout.ai psql -U postgres -d postgres -v ON_ERROR_STOP=1 < migration.sql
SET
CREATE FUNCTION
COMMENT
NOTICE:  trigger "trg_workspace_seed_default_binding" for relation "public.workspace" does not exist, skipping
DROP TRIGGER
CREATE TRIGGER
COMMENT
INSERT 0 1
NOTICE:  seed_default_framework_binding: backfill + trigger verified. Zero orphan workspaces. SMA-309 Phase 1 complete.
DO
```

Backfill: 1 row (existing dev workspace).

### Smoke test (trigger fires on new workspace)

```
before_workspaces  | 6
before_bindings    | 6
inserted_workspace_id  | 64c8da8a-...
auto_seeded_binding    | 1
binding_framework_code | hospitality.no.default.v1
```

ROLLBACK at end — no test data persisted.

### Idempotency (re-apply)

```
$ docker exec -i ... psql ... < migration.sql
INSERT 0 0  ← zero new rows, no duplicate
NOTICE:  Zero orphan workspaces. SMA-309 Phase 1 complete.
```

Re-runnable. Safe under `npx supabase db reset`.

## Known issues / debt

### Phase 2 telemetry deferred

`workspace.framework_binding_auto_seeded` event NOT registered. SQL trigger cannot emit() to TS. Three viable approaches:

1. **EF post-trigger emit:** `bootstrap-cascade` EF observes binding row exists, emits via TS `emit()`. Catches one of two paths. Requires onboarding-flow-aware emit.
2. **Audit-only via trigger:** trigger inserts directly into `activity_trail` table. Bypasses central registry but covers all paths. Hybrid pattern (registry-aware audit_trail.event_key, no PostHog routing).
3. **Skip telemetry:** rely on existing `workspace.created` upstream event. Binding becomes invisible derivation.

**Recommendation:** open separate Linear ticket "telemetry: workspace.framework_binding_auto_seeded event design" — needs telemetry-bridge ADR first.

### Niche assumption

Hardcodes `hospitality.no.default.v1`. Correct for current 100% hospitality customer base. When non-hospitality lands, trigger needs niche-aware logic (e.g. workspace.industry_code → matching framework.code lookup). Out of scope for SMA-309.

### `npx supabase migration up` history mismatch

Local DB had `20260526000000` migration applied from another worktree (`feat/engine-world-phase-1`?). `supabase migration up` refuses with "Remote migration versions not found in local migrations directory". Workaround documented above (direct psql apply). Real fix: when worktrees diverge in supabase migration history, `supabase migration repair --status reverted <id>` may be needed. Per-worktree concern, not SMA-309.

## Next steps

1. Run `~/.claude/scripts/close-feature.sh 6` (assumes `pnpm turbo typecheck` clean — pnpm install running background)
2. After merge to development → trigger ships in next deploy → all new workspaces auto-bound
3. Spin Sortie 2 (`feat/contract-dispatch-ux-pass`) — SMA-303 + SMA-305 + SMA-307
4. Open follow-up Linear: "telemetry: workspace.framework_binding_auto_seeded event design"
5. Future: niche-aware trigger when first non-hospitality workspace lands

## Acceptance gate (close-feature.sh requirements)

- [x] Decision log updated (no new ADR — uses existing ADR-0192 pattern; documented as decision in this HANDOFF)
- [x] User journeys written (`docs/journeys/JOURNEY-contract-binding-auto-seed.md`)
- [ ] `pnpm turbo typecheck` (pending pnpm install completion in wt-6 — no TS changes, expected pass)
- [x] Handoff written (this file)
- [x] Migration applied locally + smoke-tested + idempotent verified
