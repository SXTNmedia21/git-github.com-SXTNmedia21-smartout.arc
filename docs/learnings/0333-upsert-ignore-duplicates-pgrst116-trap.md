---
id: L-0333
title: upsert+ignoreDuplicates+.single() returns PGRST116 on existing-row conflict
status: canonical
layer: learning
created: 2026-05-23
updated: 2026-05-23
module: onboarding
tags: [learnings, supabase, postgrest, upsert, pgrst116, lazy-create, onboarding]
---

# L-0333 — Supabase `.upsert({ ignoreDuplicates: true }).select().single()` returns PGRST116 on existing-row conflict

## Context

Both state GET routes for the employee onboarding wizard (web cookie path + mobile Bearer path) used the following pattern as a "lazy-create-then-read" idiom:

```ts
await supabase
  .from('employee_onboarding_state')
  .upsert({ profile_id, workspace_id }, { ignoreDuplicates: true })
  .select('*')
  .single()
```

The intent: insert a row if none exists, then return it. On first call (no row) this works fine — INSERT fires, RETURNING clause returns the row, `.single()` succeeds. On every subsequent call (row exists) it silently breaks — DO NOTHING is triggered, the RETURNING clause is skipped, `.single()` receives zero rows and throws `PGRST116` → 500.

The bug was invisible in local probes because probes returned 401 before reaching the upsert. It affected every authenticated GET after the first state-row creation.

Surfaced by Council R3 (2026-05-23) via system-steward C2 + agent-coord §B confirmation.

## Discovery

PostgREST semantics for `ignoreDuplicates: true` (`ON CONFLICT DO NOTHING`): the RETURNING clause is only emitted for rows that were actually inserted. A conflict path produces zero RETURNING rows. `.select()` chained after the upsert inherits the zero-row result. `.single()` requires exactly one row — zero rows = `PGRST116 — Results contain 0 rows`.

This is NOT a bug in Supabase or PostgREST — it is correct behavior for `DO NOTHING`. The idiom is wrong.

## Impact

**The correct lazy-create patterns are:**

- (a) `.upsert(..., { ignoreDuplicates: false })` — safe ONLY when the upsert payload contains only PK/FK columns that are immutable on conflict; no risk of overwriting other fields. PostgREST emits RETURNING for both insert and update paths.
- (b) Split pattern — `.select(...).maybeSingle()` first; if null, `.insert(...)` then `.select(...).single()`.

Full enforcement rule codified in ADR-0400 Rule 3.

The sibling trap family: stale-telemetry-dist (compile context vs runtime context diverge undetected). Same class: the idiom looks correct, passes type-checking, fails only at runtime under a specific condition (existing row).

**Forward rule added to `smartout-database-guide` skill:** any `upsert + ignoreDuplicates: true` usage MUST not chain `.select().single()`. Reviewer grep: `ignoreDuplicates.*true` + `.single()` in same call chain.

## References

- ADR-0400 Rule 3 (lazy-create pattern)
- Council R3 (2026-05-23): `docs/council/COUNCIL-LOG.md`
- Server actions fixed: `apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts`
- BFF routes fixed: `apps/web/src/app/api/employee-onboarding/state/route.ts` + `apps/web/src/app/api/mobile/employee-onboarding/state/route.ts`
- Remediation commit Sortie A: `9897db3f7` (defect #1 + #2)
- Sibling: stale-telemetry-dist family (L-0190)
