---
title: "Bootstrap Domain — Roadmap"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: bootstrap
last_verified: 2026-05-23
mirror: mixed
tags: [bootstrap, roadmap, week-1, coordinator, readiness, phase]
---

# Bootstrap — Roadmap

> **mirror: mixed** — Phase 1 is verified (shipped 2026-05-23). Phases 2–5 are aspirational.

---

## Governing ADRs (references)

These ADRs govern the existing bootstrap surfaces. New phases must respect their boundaries:

| ADR | What it governs | Status |
|-----|-----------------|--------|
| ADR-0056 | Cascade Core Foundation — I1 placement | done |
| ADR-0062 | Industry Intelligence Consolidation — `packages/ai/src/industry/` owns I1 | accepted |
| ADR-0192 | Authority seed bootstrap-trigger — `engine_authority_config` seeded at workspace INSERT | accepted |
| ADR-0200 | Atomic season activation — bootstrap-cascade as canonical D1 hours writer | proposed |
| ADR-0297 | Workforce snapshot bootstrap — D2+D6 facts at session start (separate from this domain) | accepted |
| ADR-0353 | Workspace framework binding bootstrap — tariff snapshot at signup | proposed |
| ADR-0387 | Role-mandatory compliance + profession_seed (Step 11) | accepted (0387a) |

**ADR to be proposed:** Bootstrap-coordinator + workspace_readiness schema. Slot: ADR-pending. Open this ADR before starting Phase 2.

---

## Phase 1 — workspace_bootstrap_gate Schema ✅ BUILT (2026-05-23, ADR-0407)

**Status: COMPLETE**

**What was built:**
- Migration: `supabase/migrations/20260625120000_workspace_bootstrap_gate.sql`
  - `bootstrap_gate_status` enum (open|in_progress|closed|skipped|blocked)
  - `workspace_bootstrap_gate` table (workspace-scoped, RLS dual-auth)
  - 3 SECURITY DEFINER RPCs (fn_list_open_bootstrap_gates + fn_close_bootstrap_gate + fn_skip_bootstrap_gate)
  - engine_authority_config seed for 3 capability tool slugs — seeded per-workspace at Step 10 in bootstrap-cascade EF (NOT in migration; workspace_id is NOT NULL on engine_authority_config)
- K1a gate registry:
  - `BootstrapGateDefinition` type in `packages/types/src/industry.ts`
  - `getBootstrapGates()` on `hospitality.ts` (11 gates) and `default.ts` (6 gates)
- Capability: `packages/ai/src/capabilities/bootstrap/` (3 tools, gatedMutation ADR-0204)
- Bootstrap-cascade EF Step 12: seeds gate rows with auto-close detection
- Intent classifier enum entry + system prompt (ADR-0112 lag-trap closed)
- Telemetry: bootstrap.gates_listed/closed/skipped in registry.ts
- ADR-0407 registered and accepted

**Note:** The original plan named this table `workspace_readiness`. Renamed to `workspace_bootstrap_gate` in ADR-0407 to avoid collision with employee-readiness terminology.

---

## Phase 2 — Bootstrap-Coordinator

**Goal:** Orchestrator in agent-harness that reads readiness and selects today's suggested gate.

**Location:** `packages/ai/src/bootstrap/coordinator.ts` (new module, agent-harness responsibility)
**OR:** `packages/ai/src/capabilities/bootstrap/` (as a capability with tools)

**Deliverables:**
- `BootstrapCoordinator` class / module:
  - `getOpenGates(workspaceId)` — reads `workspace_readiness` table
  - `getTodaysGate(workspaceId, daysSinceActivation)` — selects gate by day-1-through-7 plan
  - `closeGate(workspaceId, gateSlug, profileId)` — delegates to appropriate capability tool
- Day-plan algorithm: maps day → gate → capability/mission
- Integration with `engine_authority_config` gate check before proposing capability calls

**Note on overlap with agent-harness:** The coordinator is agent-harness code. It is documented here as the primary domain owner. Agent-harness `GAPS-AND-DEBT` should reference this domain with "CONSOLIDATE-toward-bootstrap" for coordinator-specific concepts.

---

## Phase 3 — Session-Start Hook

**Goal:** Every Botsson session start reads readiness and surfaces open gates if we are within week 1.

**Plug-in point:** stage-engine session initialization (`services/stage-engine/` or `packages/ai/src/harness/`)
**Mechanism:**
- On session start: `getOpenGates(workspaceId)`
- If open gates + `daysSinceActivation ≤ 7` → inject bootstrap prompt slice into Botsson system prompt
- Slice: "Workspace has open bootstrap gates. Today's suggestion: [gate]. Offer to close it."
- If all gates closed OR week > 1 → skip (normal session)

**Deliverables:**
- `bootstrap-session-slice.ts` — builds system prompt slice from open gates
- Integration in stage-engine session context assembly
- Telemetry: `bootstrap.session_gate_suggested` + `bootstrap.gate_closed`

---

## Phase 4 — Week-1 Progressive UI

**Goal:** Admin sees "Day N of 7 — finish X today" on dashboard.

**Surface options:**
a. Banner on `/dashboard` (DashboardShell) — "Week 1 setup in progress — Day 3/7"
b. Dedicated `/dashboard/bootstrap` page with visual gate checklist
c. Inline on `/dashboard/setup` wizard as "Botsson suggests"

**Deliverables:**
- Server component: reads `workspace_readiness` gates via RPC
- Gate checklist UI: open/closed/skipped per gate
- "Let Botsson help" CTA on each open gate → opens Botsson voice/chat
- Progress indicator: days 1–7

**Nordic Split compliance:** Warm OKLCH palette, CSS variables only, no hardcoded colors.

---

## Phase 5 — Migrate Setup Wizard to Botsson-Driven

**Goal:** `/dashboard/setup` wizard becomes Botsson-driven only. Admin self-serve wizard is retired or demoted to "advanced / manual override."

**Deliverables:**
- Coordinator maps each of the 9 wizard steps to a bootstrap gate + Botsson capability
- `/dashboard/setup` still accessible for manual override but no longer the primary path
- `workspace.setup_guide_completed` driven by gate closure, not wizard step-count
- Update SETUP_WIZARD_ARCHITECTURE.md spec with final state

**Dependency:** Phases 1–4 must be complete before this phase is meaningful.

---

## Spec/Plan Reference

These specs and plans reference bootstrap concepts. They are dated sources — reconciled below:

| Source | Claim | Status |
|--------|-------|--------|
| `docs/superpowers/specs/SETUP_WIZARD_ARCHITECTURE.md` | `/onboarding` = bootstrap owner; `/dashboard/setup` = post-bootstrap guide. `onboarding_completed` ≠ `setup_guide_completed`. | **Confirmed** — both flags exist in migrations. Spec is accurate. |
| `docs/superpowers/plans/completed/2026-03-22-cascade-docs-alignment.md:244` | "Admin portal NEVER creates empty workspaces — always from I1 bootstrap." | **Confirmed** — `bootstrap-cascade` EF is always called from `finalize-workspace`. |
| `docs/superpowers/plans/completed/2026-03-20-cascade-architecture-foundation.md:2241` | `apps/web/src/lib/cascade/bootstrap-pipeline.ts` to be created | **Gap** — file does not exist. Bootstrap pipeline is in Edge Function, not a web lib file. |
| `docs/superpowers/plans/2026-05-19-sm-3-planlegging-hub.md:696` | "Setup-veiviser tab gated by `is_bootstrap_completed` — deferred to SM-3-followup" | **Gap** — `is_bootstrap_completed` column does not exist; closest is `onboarding_completed`. SM-3 followup not started. |
| `docs/superpowers/specs/2026-05-23-bulk-import-design.md:20` | "onboarding is wizard-scoped, bulk_import is operation-time" — first-time bootstrap is distinct from bulk import | **Confirmed** — bulk import is a separate capability. Bootstrap = first-time only. |
