---
title: "ADR-0430 Phase b sortie — INDEX"
sortie: adr-0430-shift-zone-m2m
created: 2026-05-28
status: plans-drafted-pontus-review-pending
---

# ADR-0430 Phase b — Shift × Zone × Location M:N reform (Option Y)

> **Sortie folder.** Plans + pre-flight artefakter + future reports live here. STATE.md lives one level up at `docs/domains/scheduling/STATE.md` (per SDSM convention — STATE.md is domain-scoped).

## Plans (drafted 2026-05-28, awaiting Pontus G5 review)

| Plan | File | Tier | Effort | ADR Rules covered |
|------|------|------|--------|-------------------|
| 0 | [PLAN-0 — Pre-flight gates](plans/PLAN-0-pre-flight-gates.md) | T3 | 4-6 h | CF-1..3 + §Pre-sortie gates |
| 1 | [PLAN-1 — Migrations M1+M2+M3](plans/PLAN-1-migrations-M1-M2-M3.md) | T3 | 6-10 h | Rule 1, Rule 2 (partial M1-M3), Rule 8 (partial markers) |
| 2 | [PLAN-2 — READ-rewrite](plans/PLAN-2-read-rewrite.md) | T2 | 4-6 h | Rule 3 |
| 3 | [PLAN-3 — WRITE-rewrite + G4 + Pattern B + Rule 7 + emit](plans/PLAN-3-write-rewrite-and-G4-closure.md) | T3 | 10-14 h | Rule 4, Rule 6, Rule 6b, Rule 7, Rule 9 |
| 4 | [PLAN-4 — Mobile + M4 + typegen + L-0064 final](plans/PLAN-4-mobile-M4-typegen-L0064.md) | T3 | 8-12 h | Rule 5, Rule 2 (M4), Rule 8 (final) |

**Phase b total estimated effort: 32-48 hours.**

## Anchor documents

- **ADR-0430:** [`docs/decisions/0430-core-structure-reform-shift-zone-m2m.md`](../../../decisions/0430-core-structure-reform-shift-zone-m2m.md) — status `accepted` (commit `dad1e3fd7`).
- **Council audit:** [`docs/audits/2026-05-27-core-structure-reform-index/INDEX.md`](../../../audits/2026-05-27-core-structure-reform-index/INDEX.md) — Track K verdict (8 MF + 4 CF).
- **Primary STATE.md:** [`docs/domains/scheduling/STATE.md`](../STATE.md)
- **Secondary STATE.md:** [`docs/domains/core-structure/STATE.md`](../../core-structure/STATE.md)
- **SDSM spec:** [`docs/superpowers/specs/2026-05-28-smartout-development-state-machine-design.md`](../../../superpowers/specs/2026-05-28-smartout-development-state-machine-design.md)

## Coverage matrix — every ADR-0430 binding constraint maps to ≥1 plan

| Constraint | Source | Mapped to |
|---|---|---|
| Rule 1 — composite FK invariant model | ADR §Rules | PLAN-1 §M2 |
| Rule 2 — migration ordering M1→M4 | ADR §Rules | PLAN-1 (M1-M3), PLAN-4 (M4) |
| Rule 3 — READ-rewrite first | ADR §Rules | PLAN-2 |
| Rule 4 — WRITE-rewrite with gatedMutation | ADR §Rules | PLAN-3 |
| Rule 5 — mobile rewrite per ADR-0133 parity | ADR §Rules | PLAN-4 §4.1 |
| Rule 6 — Option β telemetry (extend existing events) | ADR §Rules | PLAN-3 §3.4 |
| Rule 6b — 3 emit-site extensions | ADR §Rules | PLAN-3 §3.4 + §3.5 |
| Rule 7 — Forgery defense (ADR-0151) | ADR §Rules | PLAN-3 §3.1-3.3 |
| Rule 8 — L-0064 Class-B cleanup (2 markers, NOT Class-A) | ADR §Rules | PLAN-1 (markers) |
| Rule 9 — Channel pinning (ADR-0078) | ADR §Rules | PLAN-3 §3.6 + PLAN-0 AC-0.9 |
| CF-1 — composition orchestrator flag state | Phase 5 council | PLAN-0 |
| CF-2 — telemetry typing strategy | Phase 5 council | PLAN-0 |
| CF-3 — template Zod schema migration | Phase 5 council | PLAN-0 |
| §Pre-sortie 1 — timestamp collision check | ADR | PLAN-0 |
| §Pre-sortie 2 — ssdl composite PK confirm | ADR | PLAN-0 (already ✅) |
| §Pre-sortie M0.5 — position orphan reconciliation | ADR | PLAN-0 |
| §Pre-sortie M3-prep — default-zone definition | ADR | PLAN-0 |
| §Pre-sortie M3.5 — pg_depend audit + ensure_shift_session rewrite plan | ADR | PLAN-0 (audit), PLAN-4 (rewrite executes) |

## Future artefakter (will populate as Phase b progresses)

- `pre-flight-report.md` — produced by PLAN-0
- `pg-depend-audit.txt` — produced by PLAN-0
- `m0.5-position-orphan-report.{md,csv}` — produced by PLAN-0
- `schema-precondition-checks.sql` — produced by PLAN-0
- `reports/` — Phase B verifier outputs per plan (G6 verification artefakter)
- `screenshots/` — N/A for schema reform (no UI surfaces); skip per G8 reduction
- `journeys/` — N/A — schema reform doesn't add user journeys; M4 cleanup may touch existing zone-assignment journey doc (created in PLAN-3 E2E)

## Status

**S4 PASS → S5 plan-generation complete → G5 awaiting Pontus review.**

After Pontus G5 approval: spawn Phase b worktree, begin PLAN-0.
