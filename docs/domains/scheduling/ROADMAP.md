---
title: "Scheduling — Roadmap"
status: in_progress
updated: 2026-05-28
created: 2026-05-23
domain: scheduling
mirror: aspirational
last_verified: 2026-05-28
tags: [scheduling, roadmap, solver, marketplace, mobile, adr]
---

# Scheduling — Roadmap

> **mirror: aspirational** — items here represent forward plan pulled from open specs, plans, and ADRs.
> Confirmed shipped work lives in ARCHITECTURE.md and DATA-MODEL.md (mirror: verified).

## Open Specs (to absorb as implemented)

| Spec | Date | Topic | Status |
|---|---|---|---|
| `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` | 2026-03-21 | Cascade scheduling system design — canonical source | Absorbed into OVERVIEW + ARCHITECTURE |
| `docs/superpowers/specs/2026-03-24-shift-card-status-history-design.md` | 2026-03-24 | Shift card status history design | Partially implemented |
| `docs/superpowers/specs/2026-03-25-mal-modus-schedule-view-design.md` | 2026-03-25 | Mal-modus (template mode) design | Shipped |
| `docs/superpowers/specs/2026-03-26-admin-shift-visibility-design.md` | 2026-03-26 | Admin shift visibility | Shipped |
| `docs/superpowers/specs/2026-03-27-week-grid-schedule-redesign.md` | 2026-03-27 | Week grid redesign | Shipped |
| `docs/superpowers/specs/2026-04-23-nordic-split-phase-3a-schedule.md` | 2026-04-23 | Nordic Split phase 3a on schedule | Shipped |
| `docs/superpowers/specs/2026-05-21-dayline-shift-tasks.md` | 2026-05-21 | Day-line shift tasks | Open (plan only) |

## Open Plans

| Plan | Date | Topic | Status |
|---|---|---|---|
| `docs/superpowers/plans/2026-05-21-dayline-shift-tasks.md` | 2026-05-21 | Shift tasks in day-line (crosses scheduling/day-session/procedure-engine) | Open |

## Forward ADR Backlog (accepted or proposed, requiring implementation)

| ADR | Status | Topic | Implementation state |
|---|---|---|---|
| ADR-0066 | accepted | Temporal shift lock | ✅ Shipped (triggers + rollout migration) |
| ADR-0095 | accepted | 5-layer lifecycle | ✅ Shipped (tables + RPCs + views) |
| ADR-0096 | accepted | schedule_shift vs department_session | ✅ Documented + enforced |
| ADR-0108 | accepted | shift_lifecycle platform-neutral | 🟡 In progress |
| ADR-0277 | proposed | Mobile shift authoring via BFF | 🔴 BFF exists; legacy direct insert not yet removed |
| ADR-0288 | accepted | Voice policy own vs others | ✅ Inline guards in tools |
| ADR-0306 | accepted | Open-shift marketplace | ✅ Table + capability shipped |
| ADR-0307 | accepted | Greedy solver V1 | ✅ Shipped (`greedy.ts` + capability) |
| ADR-0309 | proposed | Bundle proposal pattern | ✅ Capability implements it |
| ADR-0321 | accepted | Swap-marketplace convergence | 🟡 V1 shipped; V2 DEFERRED |
| ADR-0332 | accepted | Dagslinjen fanout scheduler cadence | ✅ Cron seeded |
| ADR-0340 | proposed | Shift lifecycle pipeline V2 | ✅ Pipeline v2 migration shipped; capability-merge DEFERRED |
| ADR-0364 | accepted | Schedule density persistence | ✅ Shipped |
| ADR-0430 | accepted | Shift × Zone × Location M:N reform (Option Y) — Phase b implementation sortie | 🔴 Phase b not yet built (accepted 2026-05-28, 8 MF + 4 CF conditions captured in ADR body) |

## Phase Milestones — Forward Plan

### M1: Mobile BFF Authoring Closure (ADR-0277)

**Goal:** Remove legacy direct mobile insert from `apps/mobile/app/(app)/(shifts)/create.tsx`. Fully route through `POST /api/mobile/shifts` BFF with authority gate + audit reason + source attribution.

**Scope:**
- Remove `useCreateShift` direct Supabase insert in mobile
- Verify `addShiftAction` authority gate parity (`gateAction` → `gatedMutation` per ADR-0204 SS-5 backlog)
- Fix `day_category` derivation — must use workspace timezone via BFF, not device timezone

**ADRs:** ADR-0277, ADR-0133, ADR-0134, ADR-0204

### M2: Shift Lifecycle UI (ADR-0095 Phase 6)

**Goal:** 4-phase visual mapping for managers — Planlegges / Pågår / Oppgjør / Avsluttet — as proposed by Frontend Designer council 2026-04-15.

**Scope:**
- `packages/ui/wizard-like/` 4-phase mapping component
- Cockpit-driven entry per SHIFT_LIFECYCLE_MAP.md §Defects Phase 6
- Botsson as deviation mediator (deviation path)

**ADRs:** ADR-0095 Phase 6

### M3: Solver V2 (OR-Tools) — conditional

**Trigger:** Quality gap surfaces (manager feedback on greedy output quality exceeds threshold, OR second ADR-0173 audit finding on scheduler). ADR-0307 §V2 documents the upgrade path.

**Scope:**
- Python microservice (similar to `services/scrapling`) with OR-Tools CP-SAT
- Retain `propose_plan` / `accept_proposal` / `reject_proposal` tool signatures
- BFF routing from `packages/ai/src/capabilities/scheduler/` to microservice

**ADRs:** ADR-0307 (§V2 trigger conditions)

### M4: Swap+Marketplace Convergence (ADR-0340 §Q4 DEFERRED)

**Trigger:** Capability-merge demand + dedicated ADR accepted. ADR-0321 §V2 + ADR-0340 §Q4 deferred both capability collapse and `engine_authority_pipeline_instance` (superseded by `engine_state` — Q1 council finding).

**Scope:**
- If and when accepted: collapse `shift-swap` + `shift_marketplace` → `shift_lifecycle_marketplace` under ADR-0173 frozen-4 governance
- Requires cross-workspace profile policy design

**ADRs:** ADR-0321, ADR-0340, ADR-0173

### M5: Marketplace Expansion (ADR-0306 beyond MVP)

**Goal:** Per-workspace auto-approve policy, eligibility scoring, cross-department offers (if D2 competence allows).

**Scope:**
- Extend `schedule_shift_offer` with eligibility fields
- Authority config for auto-approve gate
- Mobile UX for browse + claim

**ADRs:** ADR-0306 (beyond MVP scope)

### M6: Shift Clock Coverage

**Note:** Punch-in/out execution belongs to **day-session**. If shift-clock grows into its own domain, `shift_session` (currently at the scheduling/day-session seam) may need re-assignment. Document seam before building.

**ADRs:** ADR-0096, ADR-0367

### M7: E2E Coverage Gaps

**Goal:** Full Playwright coverage for:
- Greedy solver propose+accept flow
- Swap full pipeline (request→respond→approve)
- Marketplace full pipeline (post→claim→approve)
- Temporal lock enforcement (attempt edit after lock → 403)

See [E2E-COVERAGE.md](./E2E-COVERAGE.md) for current state.
