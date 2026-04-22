---
title: Contract Hub Redesign — Spec (Council Verdict 2026-04-22)
status: accepted
updated: 2026-04-22
created: 2026-04-22
module: contracts
tags: [spec, contracts, hub, tabs, templates, drift, cascade]
---

# Contract Hub Redesign — Spec

> This spec is the condensed council verdict from 2026-04-22, which itself merged Steward / Supervisor / Agent-Coord / Frontend-Designer reviews. The implementation plan lives in `docs/plans/PLAN-contract-hub-redesign.md`. The 8 journey documents in `docs/journeys/JOURNEY-contract-*.md` are the normative behavioral contract.

## Problem

Workspace admins have no usable contract management surface:
1. `/dashboard/contracts/new` stalls on render (performance, not wiring — prior claim was stale)
2. No workspace template configuration UI exists
3. "Lag kontrakt med Botsson" header button is noise (wiring works but surface is wrong)
4. Platform admin vs workspace admin split unclear
5. Cascade hierarchy (I1 / K1a / K1b) is invisible to workspace admins

## Decision (Q1–Q8)

| Q | Decision |
|---|---|
| Q1 | **B** — Workspaces can clone K1a templates and fully edit K1b copies (including clauses). Compliance responsibility shifts to workspace; validation stays at composition-time per ADR-0076. |
| Q2 | **Tabs-in-hub merged with split-at-route.** `/dashboard/contracts` renders tabs: `Kontrakter | Maler | Bindinger`. `/settings/contracts` retires. |
| Q3 | **Remove header button, replace with ambient `Spør Botsson` chip** (hue 40, bottom-right, 25% opacity). Wiring is NOT theatre (Agent-coord verified end-to-end). Enrich `primeContext` per route. |
| Q4 | **Drawer replaces full-page wizard.** `/dashboard/contracts/new` retires. `CompositionDrawer` is single entry point for composition. |
| Q5 | **Employee-first primary**; template-first via `Maler` tab `Send til ansatte…` bulk-send. Reverse flow from `/employees/[id]` supported. |
| Q6 | **Capability matrix approved** (see council synthesis) with added rows: "View K1a→K1b fork drift" (both roles) + "Accept upstream drift" (workspace only). |
| Q7 | **Passive observability in Phase 4** (lineage badge + amber drift chip + deprecated banner). Active `change_proposal` remediation deferred to Phase 5 behind ADR-0180. |
| Q8 | **Scope in-scope as performance fix** (virtualization + spring tuning), not wiring fix. `/new` retires regardless. |

## Merge-blocking gates (G1–G5)

Must pass before Phase 1 implementation:
- **G1** — Unify `is_admin_in_workspace(uuid, uuid)` signature (real RLS inversion bug between migrations 20260228140000:201 and 20260422120000:57)
- **G2** — Register 10 telemetry events (5 template lifecycle + 3 hub events + 2 drift events) in `packages/telemetry/src/registry.ts` before any UI ships
- **G3** — `is_system` immutability via BEFORE UPDATE trigger on `contract_template` (not app-layer guard)
- **G4** — New capability tools (`fork_template`, `publish_workspace_template`, `deprecate_workspace_template`) with explicit `gate_action`, `default_allow=false`, `allowedChannels=["chat"]`, C4 authority check, NOT in mobile `suggestTools`
- **G5** — 5 lineage/lifecycle columns on `contract_template` (`source_template_id`, `source_template_version`, `forked_at`, `published_at`, `deprecated_at`) with CHECK constraint

## ADRs (Phase 0)

- **ADR-0178** — K1a→K1b Template Lineage + Drift Detection (accepted)
- **ADR-0179** — Template vs Contract Lifecycle Separation (accepted)
- **ADR-0180** — industry_intelligence Capability (proposed, deferred — gates Phase 5)

## Learnings (Phase 0)

- **L-0098** — Prior-Council-Verdict Staleness Pattern (promoted to `run-council` SKILL.md 14-day verification rule)
- **L-0099** — Tabs-in-Hub vs Split-IA Resolution Pattern
- **L-0100** — primeContext Enrichment as Alternative to Removing Affordance

## Journeys (the contract)

The normative behavior is specified in:

1. `JOURNEY-contract-hub-redesign.md` — tabs-in-hub navigation, role-gated visibility
2. `JOURNEY-workspace-template-fork.md` — K1a → K1b fork/edit/publish/deprecate
3. `JOURNEY-cascade-drift-observability.md` — Phase 4 passive lineage badges
4. `JOURNEY-platform-k1a-curation.md` — Pontus's K1a catalog flow
5. `JOURNEY-contract-bulk-send.md` — `Maler` tab `Send til ansatte…` bulk-send
6. `JOURNEY-contract-composition-engine.md` — updated: wizard → drawer flow
7. `JOURNEY-contract-preview-editor.md` — updated: preview inside drawer
8. `JOURNEY-contract-system-phase2-3.md` — updated: bindings moved to hub tab

Each journey gets E2E test before ship.

## Implementation phases

See `docs/plans/PLAN-contract-hub-redesign.md` for phase-by-phase task breakdown, owner assignments, and acceptance criteria.

- **Phase 0** — Docs + gates G1+G2 (~1-2 days)
- **Phase 1** — Schema + capability tools (G3+G4+G5) (~3-4 days)
- **Council Gate 1** — Trust Gate verification
- **Phase 2** — Hub UI redesign (~3-4 days)
- **Phase 3** — CompositionDrawer + perf + bulk-send + reverse flow (~2-3 days)
- **Phase 4** — Drift passive layer (~1-2 days)
- **Council Gate 2** — Integration verification
- **E2E tests** — 8 specs, one per journey
- **Council Gate 3** — Ship readiness

## Out of scope (Phase 5 and beyond)

- Interactive drift remediation (`change_proposal`-based diff accept/reject) — gated on ADR-0180
- `industry_intelligence` capability — gated on ADR-0180
- `edit_clause` tool for workspace admins via Botsson — Phase 5
- Mobile contract authoring — forbidden by ADR-0133 (mobile executes, does not author)
- Scheduled bulk-send (time-deferred) — Phase 5
- Clause-library reference extraction (replace inline clauses with references) — follow-up ADR

## Related

- ADR-0024 (contract system architecture)
- ADR-0076 (composition as cascade derivation)
- ADR-0077 (contract intake PII handling)
- ADR-0078 (channel restriction)
- ADR-0079 (employment_contract vs contract separation)
- ADR-0082 (drafts are not versions — contract lifecycle only)
- ADR-0133 (mobile surface boundary)
- Council log entry: `docs/council/COUNCIL-LOG.md` 2026-04-22
