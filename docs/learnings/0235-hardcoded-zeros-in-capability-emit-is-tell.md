---
title: "Hardcoded zeros in capability-tool emit data fields is a tell that route version exists"
id: LEARNING_0235
status: canonical
layer: learning
created: 2026-05-12
updated: 2026-05-12
tags: [emit, telemetry, code-smell, capability-tools, review-heuristic, f-ct-01]
---

# Learning-0235: Hardcoded zeros in capability-tool emit is a tell

## Context

Day-3 payroll period_locked notification handler council session 2026-05-12 surfaced that `packages/ai/src/capabilities/payroll/tools.ts:911-912` emits `profiles_count: 0, total_lines: 0` — both hardcoded literal zeros. Meanwhile, the BFF route at `apps/web/src/app/api/payroll/lock-period/route.ts:137-145` computes the real counts via `payroll.calculation` distinct profile_id query and emits with correct values at `:175-177`.

The capability tool emit was first-iteration scaffolding. Real data resolution lives in route. Author wrote zeros as placeholder, never wired the lookup, but shipped the emit.

## Discovery

**Pattern:** Literal `0` values in emit `properties.data.<count>` or `properties.data.<aggregate>` fields are almost always one of:

1. **Duplicate emit** — the real version with real data exists elsewhere (BFF route or downstream emit-site). The capability tool's emit was kept for ceremony or forgotten during refactor. See L-0237 (F-CT-01 dual-emit pattern).
2. **Silent data loss** — the resolver was never built; emit happens but downstream consumers see zero. If subscriber acts on count = 0 (e.g. fan-out N notifications), this is a data-loss bug not a placeholder.
3. **Author-known incomplete** — author marked it for follow-up, never came back. TODO without TODO comment.

All three cases are bugs. None should ship.

## Impact

**Code review heuristic — grep for literal-zero in emit data:**

```bash
# Find capability tool emit-sites with hardcoded zero numerics
grep -rn -B2 -A8 'await emit({' packages/ai/src/capabilities/ | grep -E '(_count|_total|amount|size):\s*0,'
```

If a result matches, ask:
- Is the real count computed elsewhere (route, hook, generator)?
- Was the resolver supposed to be wired in this emit too?
- If "yes" to either: this is either a dual-emit smell (L-0237) or silent data loss.

**Author-side discipline:** When writing a new capability tool emit and you find yourself typing `count: 0` because "we'll fix it later" — STOP. Either:
- (a) Wire the real lookup now (preferred), or
- (b) DON'T EMIT until the resolver exists. An emit with placeholder zeros is worse than no emit — it silently misinforms PostHog/audit_trail/subscriber.

**Reviewer-side discipline:** During code review of capability tool changes, if you see `(_count|_total|amount|size): 0,` in an emit data field, BLOCK PR until either (a) real resolver wired or (b) entire emit block removed.

**CI proposal:** Add to `feat/gate-action-coverage-ci` sortie a lint check:
- Pattern: `(_count|_total|amount|size|sum):\s*0,` inside `await emit({...})` blocks
- Severity: error
- Justification override: comment `// L-0235 ack: zero is the real value here` (forces author to acknowledge they thought about it)

## Recurring example sites discovered 2026-05-12

`packages/ai/src/capabilities/payroll/tools.ts:911-912`:
```ts
properties: {
  data: {
    period_id: params.period_id,
    period_start: period.start_date,
    period_end: period.end_date,
    profiles_count: 0,      // ← TELL: real value in route.ts:144
    total_lines: 0,         // ← TELL: real value in route.ts:145
    locked_by_profile_id: ctx.profileId,
    gate_evaluation_id: gate.gateEvaluationId,
  },
},
```

## References

- L-0237 — Dual-emit F-CT-01 5th occurrence (companion learning, same session)
- ADR-0303 — `notify_each_profile` dispatcher action_type (Day-3 verdict — Amendment 2 kills this emit)
- Council log: `docs/council/COUNCIL-LOG.md` 2026-05-12 entry
