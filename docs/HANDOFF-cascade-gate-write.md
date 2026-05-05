---
title: HANDOFF — cascade-gate-write (ADR-0091 WP2)
status: ready-for-merge
updated: 2026-04-18
created: 2026-04-18
module: governance
tags: [governance, adr-0091, adr-0114, c4, cascade_gate_write]
---

# HANDOFF — cascade-gate-write (ADR-0091 WP2)

## Summary

WP2 of ADR-0091 shipped: `public.cascade_gate_write` now exists as a
SECURITY DEFINER Postgres function implementing Option B (Smart Trigger
Check) — it scans `framework_trigger` rows for the workspace's active
framework, opens a `change_proposal` when a trigger matches, and always
writes a `gate_evaluation` audit row. This unblocks the
`gatedInsert/gatedUpdate/gatedDelete` TypeScript wrapper that
`perf-sprint-wave-1` scaffolded at `packages/supabase/src/gate-client.ts`
(commit `b90dc1f5`) — calls to those helpers no longer raise
`42883 function does not exist`. The council review verdict (APPROVE WITH
CHANGES) from the WP2 review session has been fully applied, including
the SECURITY DEFINER caller identity check (`assert_gate_caller`), CI
wiring of the pgTAP tests, and the clarified `GateOutcome` JSDoc.

## Commits

| Hash | Subject |
|------|---------|
| `c3a5bf8b` | docs(plan): add cascade-gate-write WP2 exploration plan |
| `2278ef52` | feat(cascade-gate-write): ship WP2 RPC (ADR-0091, Option B) |
| `6a431ce2` | fix(cascade-gate-write): council review — caller identity + CI + docstring |

## Decisions made

- **Option B chosen over Option A and Option C** per the exploration plan
  (commit `c3a5bf8b`). Option A (full WP1 rule evaluator inside the RPC)
  was rejected as out-of-scope for WP2 — evaluating `framework_rule`
  predicates is a separate body of work. Option C (pure audit log, no
  proposal creation) was rejected because it would have left the TS
  wrapper functional-but-useless: every write would return
  `{allowed: true, outcome: 'applied'}` and the gate would never exercise
  the `proposed` path. Option B (scan `framework_trigger` for a match →
  create `change_proposal` → emit `outcome='proposed'`) is the smallest
  slice that makes the full write gate behaviorally live.

- **Additive migrations rather than edit-in-place.** The council review's
  caller-identity fix ships as a new migration
  (`20260512100200_cascade_gate_write_assert.sql`) that replaces the
  function body, rather than editing
  `20260512100000_cascade_gate_write.sql` in place. Rationale: preserves
  migration history on environments that have already applied the
  original file, and keeps `supabase db diff` output readable.

- **`assert_gate_caller` as a separate SQL function, not inline.** The
  caller identity check lives in its own migration
  (`20260512100100_assert_gate_caller.sql`) and is `perform`-ed from
  inside `cascade_gate_write`. Rationale: reusable by any future
  governance RPC that wants the same identity posture (e.g. a future
  `cascade_gate_read` for PII), and making it a standalone function
  produces an explicit audit trail in `pg_proc` when the check changes.

## Learnings

- **Council code-tracer caught a SECURITY DEFINER trust gap that per-file
  review missed.** The initial WP2 implementation (commit `2278ef52`)
  trusted `p_actor_profile_id` as a function parameter without verifying
  it matched `auth.uid()` for JWT callers. Per-file review signed off;
  the code-tracer agent ran the full caller chain and surfaced that any
  authenticated user could call the RPC with an arbitrary
  `p_actor_profile_id` and the audit row would record whoever the caller
  claimed to be. Fix shipped in `6a431ce2` via `assert_gate_caller`.

- **Build agent caught six column-name drifts between draft spec and real
  schema.** The exploration plan draft referred to columns that did not
  exist on `framework_trigger`, `change_proposal`, and `gate_evaluation`
  (e.g. assumed `trigger_config` was a column, it's actually `config` on
  a different table; assumed `change_proposal.entity_id`, it's
  `target_entity_id`). Verify-before-write (querying `information_schema`
  before drafting DDL) paid for itself twice over.

- **Pre-existing migration timestamp collision at `20260506100000`
  blocks fresh `supabase db reset`.** Two pre-existing migrations share
  that exact timestamp:
  `20260506100000_governance_provenance.sql` and
  `20260506100000_shift_derivation_layer.sql`. Supabase's migration
  runner treats the pair as ambiguous and refuses to apply on a reset.
  This is not introduced by this PR — both files predate
  `feat/cascade-gate-write` — but it means reviewers cannot smoke-test
  this branch via `supabase db reset` until the collision is resolved by
  a fix-forward PR.

## Known issues / debt

- **`'blocked'` outcome is reserved but not emitted.** The SQL today only
  returns `applied | proposed`. The `blocked` case fires when
  `evaluate_framework_rules` (WP1) returns a hard rejection — that
  function is not shipped. The TypeScript wrapper tolerates all four
  outcomes so callers don't need a code change when WP1 lands; the
  wrapper's `GateOutcome` JSDoc (updated in `6a431ce2`) now documents
  the current SQL-side subset explicitly.

- **`applied_with_exception` outcome similarly reserved.** Same reason —
  requires rule-level logic that Option B does not implement. Wrapper
  tolerates it.

- **Pre-existing duplicate migration timestamp collision at
  `20260506100000`** (see Learnings above). Two files share the slot.
  Blocks fresh `supabase db reset` on this branch. Not introduced by
  this PR; flagged for a separate fix-forward PR that renames one of
  the two files.

- **WP1 (`evaluate_framework_rules`) still not shipped.** Option B uses
  `framework_trigger` match as a coarse proxy for "a rule would fire
  here." A trigger match does not necessarily mean a rule would reject
  the write — it means a rule might consider the write relevant. This
  is deliberately over-inclusive: it errs on the side of creating
  proposals, which is correct for the "Confident != Authorized" stance
  but generates some review load that WP1 will later filter down.

## Next steps

1. **Migrate first call sites** from direct `supabase.from().insert()` /
   `.update()` / `.delete()` on governance-gated tables to the
   `gatedInsert`, `gatedUpdate`, `gatedDelete` helpers from
   `packages/supabase/src/gate-client.ts`. Now unblocked by WP2.
   Suggested first targets: the `contract-compose` server action path
   and the `framework_rule` admin surface.
2. **Ship WP1 `evaluate_framework_rules`** — replaces today's
   trigger-match proxy with real per-rule predicate evaluation. Removes
   false-positive proposals.
3. **Once call sites are migrated and WP1 has shipped,** escalate the
   `smartout/no-direct-supabase-write` ESLint rule from `warn` to
   `error` in `packages/eslint-config/`. At that point direct inserts
   on governance-gated tables become a CI-blocking mistake rather than
   a warning.
4. **Rename one of the two `20260506100000_*` migrations** to resolve
   the pre-existing timestamp collision. Recommendation: bump
   `shift_derivation_layer.sql` to `20260506100100` so the governance
   migration keeps the original slot.

---

> Registered in `docs/decisions/0000-decision-log.md`.
