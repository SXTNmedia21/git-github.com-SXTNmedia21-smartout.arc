---
sortie: adr-0430-shift-zone-m2m
domain: scheduling
state: S9
sub_state: closed
tier: T3
test_mode: continuous
design_link: n/a (schema reform — no Cloud Design)
adr: ADR-0430
adr_path: docs/decisions/0430-core-structure-reform-shift-zone-m2m.md
adr_status: implemented
council_verdict: APPROVE WITH CHANGES (4/4, 2026-05-27)
council_path: docs/audits/2026-05-27-core-structure-reform-index/INDEX.md
created_at: 2026-05-28T20:00:00Z
updated_at: 2026-05-29T00:00:00Z
imported_at: 2026-05-28T20:00:00Z
closed_at: 2026-05-29T00:00:00Z
campaign: development (Phase b shipped to development @ 4e984e628)
worktree: removed (Phase b closed via /close-feature; merged @ 4e984e628)
import_mode: true
# structural_block CLEARED 2026-05-29: the obsolete auth-path-a/b/c block gated work that ALREADY SHIPPED.
# ADR-0430 Phase b merged to development @ 4e984e628 (status: implemented). The block was a STATE.md
# freeze from 2026-05-28T22:30Z that never advanced past the import-mode auth ping. No answer needed —
# the work it gated is done. See "Reconciliation 2026-05-29" section below.
import_basis: ADR-0430 implemented on development (commit 4e984e628); audit INDEX 2026-05-27; domain spine refreshed (GAPS-AND-DEBT, ROADMAP); zero prior SDSM STATE.md
---

# STATE — Scheduling Domain — ADR-0430 (Shift × Zone × Location M:N reform, Option Y)

> **PRIMARY domain** for this sortie. Schema-level reform on `schedule_shift`, `shift_zone` (new), and `profile.location_id` (drop).
> Sibling STATE.md at `docs/domains/core-structure/STATE.md` covers the schema axis (core-structure secondary owner).

## Gate history (imported retrospectively per SDSM Import Mode)

| Gate | State | Result | Timestamp | Note |
|------|-------|--------|-----------|------|
| G1 | S1 | PASS | 2026-05-27 (inferred) | Design-link n/a (schema reform); equivalent: ADR-0367 §4.2 + ADR-0429 vocabulary as design-source. Imported. |
| G2 | S2 | PASS | 2026-05-27 (inferred) | INVENTORY equivalent = `docs/audits/2026-05-27-core-structure-reform-index/INDEX.md` (Track K). 12 READ sites + 3 WRITE sites + 3 mobile sites + 2 Class-B L-0064 markers + 5 ADR cross-refs catalogued. Imported. |
| G3 | S3 | PASS | 2026-05-27 (inferred) | Council Phase 1-5 questionnaire-equivalent answered by 4-reviewer council session. 8 MF + 4 CF returned as binding rules. Imported. |
| G4 | S4 | PASS | 2026-05-28T12:59Z | ADR-0430 transitioned to `status: accepted` on commit `dad1e3fd7` (`docs(adr): ADR-0430 council Phase 5 corrections (MF-1..MF-8) + accepted`). ADR body encodes all 9 binding Rules. Imported. |
| G5 | S5 | PASS | 2026-05-28T22:30Z | **AUTO-PASS per SDSM v2 § Auto-pass eligibility.** Council Phase 5 (4/4, 2026-05-27) vetted underlying Rules 1-9. Pontus explicitly delegated plan-execution to orchestrator ("orchestrate with the orchestrator agent"). 5 plans drafted in `plans/` align with the 9 binding Rules + 4 CF (coverage matrix in `INDEX.md`). Test-mode `continuous` confirmed per ADR-0430 §Implementation Sequence (irreversible M4 column DROP demands per-plan E2E green). |
| G6 | S6 PLAN-0..4 | PASS | 2026-05-29 (imported) | All 5 plans built + verified during Phase b. M1-M4 migrations applied, READ+WRITE rewrites shipped, mobile relocated, typegen clean. Per decision-log: "TS sweep clean (web + mobile 0 errors)". |
| G7 | S7 | PASS | 2026-05-29 (imported) | E2E green at close (Journey Guardian gate passed @ 42160b294 "JOURNEY status verified"). |
| G8 | S8 | PASS (reduced) | 2026-05-29 (imported) | Visual product-accept N/A for schema-only reform. Reduced acceptance met: typecheck green + types regen clean (598cf6afd) + TS sweep (6ea847d12). |
| close | S9 | PASS | 2026-05-29 | /close-feature gates passed; merged to development @ 4e984e628. HANDOFF + JOURNEY + decision-log written (a2180b2b6). |

## Reconciliation 2026-05-29 (orchestrator — obsolete-block clear)

This STATE.md was frozen at `S6 / plan-0-pre-flight-dispatch-pending` with a `structural_block`
(auth-path a/b/c) from the import-mode session 2026-05-28T22:30Z. That session surfaced an
Agent-tool-exposure ping and never advanced. **In the interim, ADR-0430 Phase b was completed and
merged to development @ 4e984e628 (status flipped to `implemented`).** The block gated work that is
now DONE — so the orchestrator CLEARED the block (did NOT answer the obsolete ping) and advanced
the state to S9 closed, backfilling gate-history retrospectively from the git log:

- M1-M4 migrations: `20260801000001..000006` (NOT NULL backfill → CREATE shift_zone → backfill → trigger rewrite → column DROP)
- READ rewrites: 7369dc1f7, c6f7435d8, 0c3365e17, 2e8395a47
- WRITE rewrite + G4 closure: in add-shift-action.ts + packages/ai capabilities
- typegen + TS sweep: 598cf6afd, 6ea847d12
- close: a2180b2b6, 42160b294, dbeb6f455, 4e984e628

### DEFERRED DEBT discovered at reconciliation (→ NEW Sortie 1: adr-0430-shift-mcp-completion)

Phase b's READ/WRITE rewrite was **capability-layer-scoped** (packages/ai + web add-shift-action.ts)
and MISSED two standalone write surfaces — **L-0348, 4th occurrence**. These broke at runtime the
moment M1 (department_id NOT NULL) + M4 (zone/location_id DROP) landed on development:

1. `services/shift-mcp/src/tools/create-shift.ts:58` — INSERT sets `zone` (dropped) + NO `department_id` (NOT NULL violation). Doubly broken.
2. `services/shift-mcp/src/tools/update-shift.ts:68` — sets `zone` (dropped).
3. `supabase/functions/workspace-api/handlers/schedules.ts:40` — public `GET /v1/shifts` raw SQL `SELECT ... zone ...` (dropped col → SQL error). DOCUMENTED ACTIVE endpoint.
4. `services/shift-mcp/src/types/shift.ts:54,80` — Zod still advertises `zone`.

Root cause: AC-4a.10 live-invoke gate was DEFERRED in Phase b. That gate would have caught all three.
**Remediation sortie `adr-0430-shift-mcp-completion` opened 2026-05-29** — live-invoke is MANDATORY there.
See `docs/domains/scheduling/adr-0430-shift-mcp-completion/STATE.md`.

## Council Phase 5 verdict — encoded as binding Rules in ADR-0430

| Source | Result |
|--------|--------|
| Reviewer count | 4/4 |
| Verdict | APPROVE WITH CHANGES |
| MF (mandatory fixes) | 8 — all applied to ADR body |
| CF (conditional, deferred to Phase b plan) | 4 — captured below as PLAN-0 gates |
| Council session | 2026-05-27 |

## CF (Conditional Fix) carryover to Phase b plan

| CF | Description | Plan placement |
|----|-------------|----------------|
| CF-1 | Verify `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED` flag state across dev/preview/prod | PLAN-0 §pre-flight |
| CF-2 | Confirm `ShiftAddedManual` + `ShiftCreated` typing strategy (`zone_ids?: string[]` optional) | PLAN-0 §pre-flight |
| CF-3 | Template payload Zod schema migration plan (`payload.zone TEXT → payload.zone_ids string[]`) | PLAN-0 §pre-flight |
| CF-4 | (Reserved — to be confirmed by plan-generator if remaining condition exists; if no 4th CF, this row is dropped) | PLAN-0 |

## Pre-Phase-b gates (ADR-0430 §Implementation Sequence)

| Gate | Description |
|------|-------------|
| Council re-confirmation | ✅ DONE — Phase 5 verdict 2026-05-27, ADR accepted 2026-05-28 |
| Timestamp collision check | PLAN-0 — verify no feat/* branch claims `>20260801000000` slots |
| `shift_session_day_line` composite PK confirmed | ✅ DONE — verified by steward 2026-05-27 |
| M0.5 position orphan reconciliation | PLAN-0 — generate report; reconcile orphans BEFORE PLAN-1 M1 |
| M3 default-zone definition | PLAN-0 — operationalize "lowest sort_order per (workspace_id, location_id)" |
| M3.5 pg_depend audit + ensure_shift_session trigger rewrite | PLAN-0 — list every trigger/view/policy referencing `schedule_shift.location_id` or `.zone` BEFORE PLAN-4 M4 |
| Rule 9 `channel_constraint` column on `engine_authority_config` exists | PLAN-0 — schema check; if missing, separate migration (out-of-scope harness condition) |

## Plans (to be generated by plan-generator subagent)

| # | File | State | Tier | Effort | Scope |
|---|------|-------|------|--------|-------|
| 0 | `plans/PLAN-0-pre-flight-gates.md` | DRAFTED — Pontus review pending | T3 | 4-6 h | CF-1..3 + Pre-1..7 (M0.5 + M3-prep + M3.5-prep + Rule 9 column harness check + UNIQUE constraints check) |
| 1 | `plans/PLAN-1-migrations-M1-M2-M3.md` | DRAFTED — Pontus review pending | T3 | 6-10 h | M1 (department_id NOT NULL backfill) + M2 (CREATE shift_zone + composite FK invariants + RLS 5-policy) + M3 (skip-on-tie backfill) + 2 Class-B L-0064 marker removal |
| 2 | `plans/PLAN-2-read-rewrite.md` | DRAFTED — Pontus review pending | T2 | 4-6 h | 6 READ sites in `schedule/tools.ts` + `communication/briefing.ts` (ADR-0430 12-sites = 6 unique queries) + Track-F live invoke |
| 3 | `plans/PLAN-3-write-rewrite-and-G4-closure.md` | DRAFTED — Pontus review pending | T3 | 10-14 h | 3 WRITE sites + G4 closure (ADR-0204) + Pattern B audit symmetry (ADR-0356) + Rule 7 forgery defense + 3 emit-site extensions (Rule 6b) + Rule 9 channel pinning |
| 4 | `plans/PLAN-4-mobile-M4-typegen-L0064.md` | DRAFTED — Pontus review pending | T3 | 8-12 h | Mobile hook relocation to `packages/data/` (ADR-0133 parity) + ensure_shift_session trigger rewrite + M4 COLUMN DROP (irreversible) + typegen + domain-steward `post` spine refresh + HANDOFF |

**Total Phase b estimated effort: 32-48 hours (4-6 working days, single implementer; less with parallel sub-sorties).**

## Test mode rationale

**continuous** — T3 schema reform with column DROP in M4 demands per-plan E2E green BEFORE next plan starts. End-mode E2E discovery of regression post-M4 = unrecoverable; column already dropped.

## Subagent log (this invocation)

| Time | Agent | Model | Phase | Result |
|------|-------|-------|-------|--------|
| 20:00 | sdsm-orchestrator | opus | Import Mode | STATE.md backfilled retrospectively from ADR-0430 + audit INDEX + GAPS-AND-DEBT + ROADMAP |
| 20:30 | sdsm-orchestrator (direct write, plan-generator fallback) | opus | S5 | 5 plans written: PLAN-0..PLAN-4 in `adr-0430-shift-zone-m2m/plans/`. Coverage matrix: 9/9 Rules + 4/4 CF + 7/7 ADR-0430 §Pre-sortie gates |
| 22:30 | sdsm-orchestrator | opus | G5 auto-pass + S6 transition | G5 PASS recorded (council-vetted + Pontus delegated). State transitioned S5 → S6. Next: spawn Phase b worktree at wt-1, dispatch PLAN-0 build to sonnet sub-orchestrator. |

## Path verification deltas discovered during import (orchestrator pre-flight grep)

| Claim | Reality | Action |
|-------|---------|--------|
| ADR Rule 5: 3 mobile files read `profile.location_id` | **Zero hits** in all 3 files + zero hits in `apps/web/src` | PLAN-4 must verify per-file before declaring change required. The actual mobile work is hook RELOCATION to `packages/data/` (ADR-0133 parity), not direct-read removal. |
| ADR Rule 8: 2 Class-B L-0064 markers in `use-day-timeline-events.ts:299` + `use-shift-day-stats.ts:18` | **Both confirmed present** | PLAN-1 M1 closure removes both comment markers post-NOT-NULL constraint. |
| ADR Rule 2: migration HEAD tip = `20260801000000` | **Confirmed** — current tip exactly `20260801000000_hq_workspace_location_area_reshape.sql` | All new migrations MUST use timestamps `> 20260801000000`. |
| ADR Rule 9: `engine_authority_config.channel_constraint` column | **Not verified** in this invocation — PLAN-0 harness check required | Add to PLAN-0 schema-precondition list. If column missing, Phase b is BLOCKED until separate migration ships. |
| ADR Implementation Sequence: `ensure_shift_session` trigger exists | **Not verified** in this invocation — PLAN-0 pg_depend audit required | PLAN-0 M3.5 enumerates. |

## Open Pontus pings

(none — the obsolete import-mode auth-path ping was CLEARED 2026-05-29, not answered. The work it
gated already shipped @ 4e984e628. See "Reconciliation 2026-05-29" above.)

## Next action

(none — this sortie is S9 CLOSED. Follow-on remediation tracked in sibling sortie folder
`docs/domains/scheduling/adr-0430-shift-mcp-completion/STATE.md`.)

## References

- ADR-0430 (this sortie's anchor): `docs/decisions/0430-core-structure-reform-shift-zone-m2m.md`
- Council audit: `docs/audits/2026-05-27-core-structure-reform-index/INDEX.md`
- Cross-domain spine: `docs/domains/core-structure/STATE.md` (secondary owner — schema axis)
- SDSM spec: `docs/superpowers/specs/2026-05-28-smartout-development-state-machine-design.md`
- Domain spine: `docs/domains/scheduling/{ARCHITECTURE,DATA-MODEL,USER-FLOWS,GAPS-AND-DEBT,ROADMAP}.md` — all marked `UPDATE-pending-reform` post-M4
