---
title: Telemetry End-to-End Gate — every endpoint proven, live in the stream
status: draft
updated: 2026-06-03
created: 2026-06-03
module: campaign
tags: [telemetry, gate, end-to-end, live-status, activity-trail, speedtest]
---

# Telemetry End-to-End Gate

> Same pattern as the Design Fidelity Gate — a script the agent runs but doesn't write, returns
> per-endpoint pass/fail + an aggregate, and a page/domain is **telemetry-done** only at 100% green.
> The twist Pontus wants: a **live status-light in the agent's stream** — gate-by-gate flips green as the
> work happens, so you watch telemetry come alive. **Yes, it's possible.** Here's how.

## What it proves (end-to-end, 3 layers)

Per endpoint/event, the gate checks all three — a "light" per layer:

| Layer | Check | Source |
|-------|-------|--------|
| **L1 — defined** | event exists in the registry | `packages/telemetry/src/registry.ts` (225 defined) |
| **L2 — emitted** | `emit()` is called at a real call-site | grep call-sites (`emit-coverage.sh`) |
| **L3 — landed** | firing it lands a row in `activity_trail` | DB-assert on `activity_trail` (353 rows today) |

Green endpoint = all 3. 100% of endpoints green = **all telemetry set up.**

## The endpoint list (defined in the spec — you set the count)

The gate doesn't guess scope — **the spec declares which endpoints must be covered** (per domain or page).
You write: "kommunikasjon needs these 22 events; vaktplan these 36." The gate measures against that list.
Out-of-list = not the gate's job; in-list-but-not-green = a red light.

## The live status-light in the stream (the new part)

The gate prints **one line per endpoint as it checks it** — live stdout in the agent's terminal:

```
▶ telemetry e2e — kommunikasjon (22 endpoints)
  🟢 announcement.published        L1✓ L2✓ L3✓
  🟢 announcement.reminder_sent    L1✓ L2✓ L3✓
  🟡 channel.created               L1✓ L2✓ L3·    (defined+emitted, not yet landed)
  🔴 message.posted                L1✓ L2·  L3·    (defined, never emitted)
  …
  ─────────────────────────────────────────────
  18/22 green · 82% · confidence 91%  → NOT READY (4 red)
```

As the agent wires each event, re-run → more lights flip 🔴→🟡→🟢. You **watch gate-for-gate go green**.
At 22/22 → 🟢 100% → `AWAITING-HUMAN-APPROVAL`. That's the speedtest light you asked for, in the stream.

## Plugs into the same harness

It's a verify-task with subtasks (one per endpoint), each printing `{"percent":N,"confidence":N}` →
`run-verify.sh` iterates → aggregate → 100% gate → human-approval (C4). Identical to the fidelity gate.

- **percent** = green endpoints / total.
- **confidence** = how sure (L3 DB-assert = high; L2-only = capped — emitted-but-not-proven-landed).

## Why it can't be faked

The agent runs the gate; it does not write the L3 DB-assert (that reads `activity_trail` directly). A page
can't claim telemetry-done — the gate counts real rows. 225 defined vs 353 landed today is exactly the kind
of gap this makes visible per-endpoint.

## Status

- L1/L2 checks: exist (`registry.ts` + `emit-coverage.sh`).
- L3 DB-assert: available (`activity_trail` up, local DB).
- Live status-light printer + per-endpoint spec list: to build (orchestrator).
- Harness (`run-verify.sh`): ✅ built, subtask-aware.
