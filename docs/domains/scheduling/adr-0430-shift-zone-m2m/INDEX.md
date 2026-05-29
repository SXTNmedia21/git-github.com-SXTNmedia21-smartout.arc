---
title: "ADR-0430 Phase b sortie — INDEX"
sortie: adr-0430-shift-zone-m2m
created: 2026-05-28
updated: 2026-05-29
status: S6-plan-0-pre-flight-dispatch-pending
---

# ADR-0430 Phase b — Shift × Zone × Location M:N reform (Option Y)

> **Sortie folder.** Plans + pre-flight artefakter + future reports live here. STATE.md lives one level up at `docs/domains/scheduling/STATE.md` (per SDSM convention — STATE.md is domain-scoped).

## Plans (PLAN-4 split into 4a/4b after council Phase 5, 2026-05-29)

| Plan | File | Tier | Effort | ADR Rules covered |
|------|------|------|--------|-------------------|
| 0 | [PLAN-0 — Pre-flight gates](plans/PLAN-0-pre-flight-gates.md) | T3 | 4-6 h | CF-1..3 + §Pre-sortie gates |
| 1 | [PLAN-1 — Migrations M1+M2+M3](plans/PLAN-1-migrations-M1-M2-M3.md) | T3 | 6-10 h | Rule 1, Rule 2 (partial M1-M3), Rule 8 (partial markers) |
| 2 | [PLAN-2 — READ-rewrite](plans/PLAN-2-read-rewrite.md) | T2 | 4-6 h | Rule 3 |
| 3 | [PLAN-3 — WRITE-rewrite + G4 + Pattern B + Rule 7 + emit](plans/PLAN-3-write-rewrite-and-G4-closure.md) | T3 | 10-14 h | Rule 4, Rule 6, Rule 6b, Rule 7, Rule 9 |
| 4a | [PLAN-4a — Zone render readback (42-site blocker)](plans/PLAN-4a-zone-render-readback.md) | T2 | 2-3 h | Rule 3 display-propagation, Rule 5 mobile-display |
| 4b | [PLAN-4b — Mobile + M4 + typegen + spine + HANDOFF](plans/PLAN-4b-mobile-M4-typegen-spine-handoff.md) | T3 | 6-9 h | Rule 5, Rule 2 (M4), Rule 8 (final) |

> PLAN-4 (`PLAN-4-mobile-M4-typegen-L0064.md`) was superseded by 4a + 4b after
> council Phase 5 (2026-05-29). 5/5 reviewers APPROVE Option A — funnel-first mapper
> rewrite + 8 MF amendments. See
> [COUNCIL-PLAN-4-strategy-17-site.md](COUNCIL-PLAN-4-strategy-17-site.md).

**Phase b total estimated effort: 32-46 hours.**

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
| Rule 2 — migration ordering M1→M4 | ADR §Rules | PLAN-1 (M1-M3), PLAN-4b (M4) |
| Rule 3 — READ-rewrite first | ADR §Rules | PLAN-2 |
| Rule 3 display-propagation — 42 read/display sites consume zones[] | Council MF-1 | PLAN-4a |
| Rule 4 — WRITE-rewrite with gatedMutation | ADR §Rules | PLAN-3 |
| Rule 5 — mobile rewrite per ADR-0133 parity | ADR §Rules | PLAN-4a (display), PLAN-4b §4b.1 (hook relocation) |
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
| §Pre-sortie M3.5 — pg_depend audit + ensure_shift_session rewrite plan | ADR | PLAN-0 (audit), PLAN-4b §4b.2 (rewrite executes) |
| MF-Prior-1 — trigger DROP+CREATE (not OR REPLACE); no OF location_id | Council pre-council | PLAN-4b §4b.2 |
| MF-Prior-2 — typegen target src/ not dist/ | Council pre-council | PLAN-4b §4b.4 |
| MF-Prior-3 — JOURNEY required (close-feature gate) | Council pre-council | PLAN-4b §4b.7 |
| MF-Prior-4 — HANDOFF deferred-enforcement section (Rule 9 dead-letter) | Council pre-council | PLAN-4b §4b.8 |
| MF-Prior-5 — fk_profile_location explicit DROP CONSTRAINT before column drop | Council pre-council | PLAN-4b §4b.3 |
| MF-Prior-6 — mobile hook kebab-case in packages/data/src/day-session/ | Council pre-council | PLAN-4b §4b.1 |
| MF-Prior-7 — day-session DATA-MODEL.md:~343 annotation removal | Council pre-council | PLAN-4b §4b.6 |

## Future artefakter (will populate as Phase b progresses)

- `pre-flight-report.md` — produced by PLAN-0
- `pg-depend-audit.txt` — produced by PLAN-0
- `m0.5-position-orphan-report.{md,csv}` — produced by PLAN-0
- `schema-precondition-checks.sql` — produced by PLAN-0
- `reports/` — Phase B verifier outputs per plan (G6 verification artefakter)
- `screenshots/` — N/A for schema reform (no UI surfaces); skip per G8 reduction
- `journeys/` — N/A — schema reform doesn't add user journeys; M4 cleanup may touch existing zone-assignment journey doc (created in PLAN-3 E2E)

## Council log

- **Phase 5 PLAN-4 strategy** — [COUNCIL-PLAN-4-strategy-17-site.md](COUNCIL-PLAN-4-strategy-17-site.md) — 2026-05-29 — 5/5 APPROVE Option A

## Status

**PLAN-0 through PLAN-3 SHIPPED.** Branch tip `ed5955df1`. Gate trail: S4 PASS → S5 plan-generation complete → G5 PASS (auto, 2026-05-28T22:30Z) → S6 build → PLAN-0 ✅ → PLAN-1 ✅ → PLAN-2 ✅ → PLAN-3 ✅ → **Council Phase 5 on PLAN-4 (2026-05-29): PLAN-4 split into 4a + 4b.**

Next: dispatch PLAN-4a (zone render readback — 42 sites, mapper funnel). PLAN-4b blocked on PLAN-4a AC-4a.8 (pre-grep gate = 0) and AC-4a.9 (typecheck GREEN).
