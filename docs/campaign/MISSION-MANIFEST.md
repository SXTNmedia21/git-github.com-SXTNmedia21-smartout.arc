---
title: Mission Manifest — Nordic Split refactor onto the live SmartOut app
status: draft
updated: 2026-06-03
created: 2026-06-03
module: campaign
tags: [mission, milestones, tracks, waves, roadmap, refactor]
---

# Mission Manifest

> **Mission:** land the finished Nordic Split design onto the existing, live SmartOut app — faithfully,
> reuse-first, page by page — until **every domain is at L3** (telemetry proven in `activity_trail`,
> zero phantoms). Done = a disk read, not a verdict.

All numbers below are **read from disk** (`telemetry-map/<domain>/control.json`, 2026-06-03) — not estimates.

## 1. Tracks (parallel lanes)

| Track | Owner | Scope |
|-------|-------|-------|
| **Web** | web orchestrator + builders | dashboard pages — port + adapter + wire + L3 |
| **Mobile** | mobile orchestrator + builders | D6 production + C4 acceptance (ADR-0133); AI via web BFF (ADR-0132) |
| **DB / backend-gap** | the single Database Agent | domains with backend gaps close DB **first** (DB-wall gated) |

Lanes don't cross. Orchestrator dispatches · builder ports · verifier grades · steward commits · Pontus pushes/approves G8.

## 2. Waves (friction-ordered — lightest first, the proven motion repeats)

| Wave | Domains | elements | mutations | events | Why this wave |
|------|---------|:---:|:---:|:---:|---------------|
| **W0 — Golden-path** ✅ | `min-dag` | 21 | 5 | 15 | done — proved the loop (L3 + steward + tag `min-dag/ready`) |
| **W1 — Light fan-out** | `oversikt` (ported), `oppgaver`, `planlegging` | 19·38·43 | 0·14·14 | 11·19·29 | smallest surfaces — prove **parallel** fan-out works |
| **W2 — Medium** | `kommunikasjon`, `lonn` | 46·71 | 22·13 | 22·13 | `lonn` is light on mutations (13) despite size |
| **W3 — Heavy** | `avstemming`, `hms` | 97·145 | 40·38 | 19·38 | high mutation count — backend-gap track likely engages |
| **W4 — Heaviest** | `vaktplan`, `ansatte` | 153·164 | 91·34 | 91·34 | `vaktplan` = 91 mutations (heaviest pole); do last with most proof in hand |

10 domains total. W0 done · `oversikt` already has `port_files` (in-flight). 8 remain.

## 3. Milestones (gates between waves)

| # | Milestone | Done when |
|---|-----------|-----------|
| **M0** Foundation ✅ | tokens ported · harness gates · golden-path `min-dag` at L3 |
| **M1** Parallel fan-out proven | W1 domains all L3 (proves >1 domain in isolated worktrees, no collision) |
| **M2** Medium clear | W2 domains L3 |
| **M3** Heavy clear | W3 domains L3 (incl. backend-gap closes) |
| **M4** Heaviest clear | W4 domains L3 |
| **M5** Campaign done | **all 10 domains L3 · mobile parity · zero phantoms** across `activity_trail` |

A wave does not open until the prior wave's milestone is green **on disk**.

## 4. Tasks (the per-domain loop — identical every domain)

Each domain is one run of the proven motion. The MISSION brief carries: scope · branch · the L3 done-test.

1. **Isolate** — worktree-per-domain (sub-sortie); orchestrator confirms physical worktree exists before dispatch.
2. **Port** — copy design JSX 1:1 (plumbing-only edits; ~2× line-count = rewrite → reject).
3. **Adapt** — one `toDesignShape(realRows)` adapter; design renders unchanged.
4. **Wire** — real source from v1, or honest empty state (no ghost data).
5. **Register telemetry** — every mutation → registry entry + `emit()` (L2).
6. **Prove L3** — fire each event for real → assert row in `activity_trail` (DB-assert, not UI-200) → `emit-coverage.sh` 0 phantoms.
7. **Steward commit + tag** — `commit-steward` (DoD + bounce + ledger), tag `<domain>/ready`. Pontus pushes.
8. **Mobile parity check** (ADR-0133) — data hooks in `packages/`; mobile counterpart for D6/C4 verbs.

## 5. Timeline (wave-sequenced — honest, not fake-dated)

Dates are **not** invented (no-ghost rule applies to schedules too). Sequencing + relative weight:

```
W0 ✅ ──► W1 (3 light, parallel) ──► W2 (2 med) ──► W3 (2 heavy +DB) ──► W4 (2 heaviest)
         │                                                                            │
         └─ M1 gate                                                          M5 = done ┘
```

- **Critical-path dependency:** L3 needs a running app → **op-signin + web boot** (currently blocked; Pontus's biometric). Until then, runs reach **L2 on disk**; L3 closes the moment web is up.
- **Pace:** light domains ≈ one run each; heavy (`vaktplan`/`ansatte`) ≈ multi-run + backend-gap first.
- Absolute dates set per-wave **when web unblocks** — drop them in then, don't guess now.

## Open / owned elsewhere

- ADR-0047 / F1 / ADR-0115 — **PO** (chronicle-product-owner) decisions, not code-side.
- This manifest is code-grounded; reconcile with the PO's ROADMAP when the bridge syncs.
