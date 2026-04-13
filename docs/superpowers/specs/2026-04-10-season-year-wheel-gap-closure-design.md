---
title: "Season and Year Wheel Gap Closure - Design Spec"
status: superseded
superseded_by: docs/modules/MODULE_YEAR_WHEEL_PRD.md
updated: 2026-04-12
created: 2026-04-10
module: cascade
tags: [season, year-wheel, planning-cycle, cascade, gaps, readiness]
---

> **SUPERSEDED:** Remaining gaps have been moved into the Year Wheel PRD v2.0.0
> (`docs/modules/MODULE_YEAR_WHEEL_PRD.md`, Sections 12-14). Retained for audit trail.

# Season and Year Wheel Gap Closure - Design Spec

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Define exactly what remains to make Season + Year Wheel handling fully operational in production, including product gaps, technical gaps, and readiness gates.

**Architecture baseline:** `planning_cycle` (D1), `season` + `season_budget` + factors (D4), and engine-triggered session lifecycle are already present. This spec closes the remaining product and reliability gaps.

---

## 1. Current State Snapshot

### 1.1 Implemented and working

- `planning_cycle` table, enums, constraints, and RLS are in place.
- `season.planning_cycle_id` link exists and is writable from Season UI.
- Season page has year wheel selector (`PlanningCycleSelector`) and cycle create/link flow.
- Season budget, day factors, hour factors, and planning events CRUD are implemented.
- DB trigger + engine trigger for `season.activated` exists and can start session lifecycle flow.
- Cascade bootstrap seeds a default planning cycle for new workspaces.

### 1.2 Implemented but partial

- Planning events are not scoped by the selected season/year wheel in the current season tab rendering flow.
- Year wheel exists as data and selector UX, but not as a dedicated operational surface.
- Goals and Procedures tabs on season page are placeholders without domain writes.

### 1.3 Not yet operationally complete

- End-to-end reliability proof for critical event chains is missing.
- Idempotency and single-source event ownership needs hardening across trigger paths.
- Product governance for year wheel lifecycle (active cycle rules, archive/transition policy) is incomplete.

---

## 2. Definition of 100 Percent Operational

Season and Year Wheel are considered fully operational when all conditions below are true:

1. **Product completeness:** Users can define, manage, and apply year wheel periods and season controls without placeholder surfaces.
2. **Correct scoping:** All season planning data is consistently scoped to selected season and linked planning cycle.
3. **Reliable execution chain:** Activation and budget propagation flows are deterministic, idempotent, and validated by E2E tests.
4. **Operational visibility:** Failures are observable through logs, health checks, and explicit dashboards/queries.
5. **Documented truth:** Specs, plans, architecture docs, and ADR notes reflect real behavior with no contradictory guidance.

---

## 3. Gap Map

## P0 Gaps (Block production confidence)

### Gap P0-1: Event chain determinism and idempotency

**Problem:** Multiple pathways can emit semantically similar events (`season activated` telemetry and DB-triggered `season.activated`), risking duplicate downstream behavior unless carefully controlled.

**Required outcome:**

- One canonical activation contract documented and enforced.
- Duplicate-safe behavior proven for session lifecycle and budget propagation.
- Regression tests cover repeated activation and replay scenarios.

### Gap P0-2: Missing E2E proof of critical season flows

**Problem:** Core chains exist in pieces but lack full evidence-based verification.

**Required outcome:**

- Automated tests for:
  - `season activate -> engine_event -> department_session upsert`
  - `season_budget/day_factors update -> workspace_budget propagation`
  - planning cycle link/unlink impact on season views

### Gap P0-3: Planning events not scoped to selected season cycle

**Problem:** Events currently load workspace-wide in season events tab path.

**Required outcome:**

- Events shown in season context are filtered by selected season's linked `planning_cycle_id` by default.
- Optional toggle for workspace-wide view can exist, but default must be scoped.

---

## P1 Gaps (Operational product incompleteness)

### Gap P1-1: Year wheel lifecycle management UX

**Problem:** Selector exists, but no full year wheel management surface for status transitions, overlap guidance, and lifecycle operations.

**Required outcome:**

- Dedicated Year Wheel management surface (or expanded selector flow) supporting:
  - create, edit, archive, activate/deactivate
  - clear conflict feedback (overlap constraint handling)
  - explicit active period semantics

### Gap P1-2: Season Goals and Procedures are placeholders

**Problem:** `Mål` and `Prosedyrer & HMS` tabs are visual placeholders only.

**Required outcome:**

- Goals model and UI with persistence and season scoping.
- Procedure/HMS activation model per season with persistence and audit trail.

### Gap P1-3: Year wheel governance policy not explicit

**Problem:** Rules for active cycle policy and transition strategy are implicit.

**Required outcome:**

- Decision-recorded policy for:
  - single active cycle vs multiple active cycles
  - archive behavior and handover cadence
  - fallback behavior for seasons without linked cycle

---

## P2 Gaps (Maturity and scale)

### Gap P2-1: Read-only analytics for year wheel quality

- Missing quality indicators such as cycle coverage, seasonal alignment, and unlinked seasons.

### Gap P2-2: Operational runbook and support SQL pack

- Missing consolidated runbook for on-call triage of season activation and propagation failures.

### Gap P2-3: Documentation drift and stale wording

- Module and reference docs still contain historical wording that can conflict with current implementation details.

---

## 4. Key Workstreams

### Workstream A - Reliability and event contract hardening (P0)

- Normalize season activation event ownership.
- Add idempotency validation and duplicate-safe test matrix.
- Verify engine trigger behavior under replay and failure-retry conditions.

### Workstream B - Season-scoped data correctness (P0)

- Enforce `planning_cycle_id` scoping in season event loading.
- Validate query keys and cache invalidation around season/cycle switching.

### Workstream C - Year wheel management experience (P1)

- Build explicit year wheel management workflow.
- Expose status transitions and lifecycle actions in UI.

### Workstream D - Goals and Procedures implementation (P1)

- Replace placeholders with persisted, season-scoped domain features.
- Ensure telemetry emit coverage for all mutations.

### Workstream E - Readiness and observability (P0/P2)

- Add E2E tests for critical paths.
- Add health checks and incident query pack for season chain failures.

### Workstream F - Documentation and decision alignment (P1/P2)

- Update architecture/module/reference docs to match code truth.
- Add decision log entries for remaining governance choices.

---

## 5. Acceptance Criteria

This spec is complete when all acceptance criteria pass:

1. Season activation path is deterministic and duplicate-safe under repeated triggers.
2. Budget propagation updates `workspace_budget` correctly after budget/factor mutations.
3. Planning events are scoped by selected season cycle by default.
4. Year wheel can be managed end-to-end from product UI without hidden/manual SQL steps.
5. Goals and Procedures tabs are no longer placeholders.
6. E2E suite includes season/year-wheel critical path tests and passes.
7. Docs and ADR references are aligned and no longer contradict live behavior.

---

## 6. Implementation Sequence (Recommended)

1. **P0 chain hardening first** (event contract, idempotency, critical E2E tests)
2. **P0 scoping correction** (planning events by selected cycle)
3. **P1 year wheel management UX**
4. **P1 goals/procedures implementation**
5. **P2 observability and documentation finalization**

This order minimizes operational risk while preserving delivery flow.

---

## 7. Out of Scope

- External ERP adapters (Phase D integrations)
- Full C1/C2/C3 control-plane automation beyond season-critical paths
- Broad redesign outside season/year-wheel domain

