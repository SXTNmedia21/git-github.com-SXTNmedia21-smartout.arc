---
topic: coverage-map-drifts-from-source
status: active
created: 2026-06-01T01:15:00Z
updated: 2026-06-01T01:15:00Z
supersedes:
metadata:
  class: measurement-drift
  severity: high
  enforcement: reconcile.sh (read-only) — measure against source, not the derived map
---

# A derived coverage map drifts from its source of truth — reconcile before trusting it

## What happened (2026-06-01)

The telemetry-coverage campaign measured Completion Rate from per-domain `control.json` maps
(`events_in_registry` / `events_required`). The gate read **57%**. It was wrong.

The maps are a DERIVED snapshot. The SOURCE OF TRUTH is `packages/telemetry/src/registry.ts`.
After the F0.1 design-ingest added 121 events to registry.ts (restored in commit e1b4b0151),
the maps were never reconciled — they still listed those 121 as `events_missing_from_registry`.

Reconciling each "missing" event against registry.ts:

```
stated (maps) : 166/291 = 57%
REAL (truth)  : 269/291 = 92.4%
false-missing : 123  (in registry.ts, but maps still say missing)
genuinely missing : 22  (vaktplan 21, lonn 1 — mostly deferred/stub/schema-gated)
8 of 10 domains were already REAL 100% — pure measurement artifact.
```

## The near-miss

A builder was almost dispatched to "register 11 missing vaktplan events." All 11 were ALREADY
in registry.ts (lines 11432–11550). The dispatch would have been pure waste. What caught it:
**verify the claim against the source (grep registry.ts) before acting** — not trusting the map.

## The rule

1. **Measure against the source of truth, never only a derived map.** A map (control.json,
   an index, a cache, a dashboard count) drifts the moment the source moves. Treat it as a hint,
   re-derive from source before trusting a metric or dispatching work off it.
2. **Reconcile after any bulk source change.** When 100+ events land in registry.ts, the maps
   are stale until reconciled. Build the reconcile into the loop (DRIVE-TO-100 step 4), don't
   leave it to memory.
3. **A coverage number > the obvious bound (e.g. >100%) means the metric, not the system, is
   wrong.** Fix the formula (`covered = required − genuinely_missing`), don't report the artifact.

## Tools (on disk, telemetry-map/)

- `completion-rate.sh` — STATED rate from the maps (what the maps claim).
- `reconcile.sh` — REAL rate: each "missing" event checked against registry.ts (read-only, no mutation).
- `next-domain.sh` — nominate next domain (achievable-friction mode).

Related: [[commit-early-untracked-is-vulnerable]] (verify-from-disk discipline, same family).
