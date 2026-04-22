---
name: Contract Management Redesign Council (Phase 5 Synthesis)
description: 2026-04-22 synthesis — Q1=B locked, tabs-in-hub, drawer replaces /new, 5 G-conditions, 3 ADRs, 3 learnings
type: project
---

# Contract Management Redesign — Phase 5 Synthesis (2026-04-22)

## Verdict
**APPROVE WITH CHANGES** — Q1=B locked; 10 binding conditions; G1–G5 merge-blockers.

## Key Decisions

### IA Shape (Conflict A)
Tabs-in-hub wins. `/dashboard/contracts` with tabs: `Kontrakter | Maler | Bindinger`.
`/settings/contracts` retired. Access control by tab-level RLS visibility.

### Botsson (Conflict B)
Button was NOT theatre (Agent-coord refuted prior claim via end-to-end trace).
Remove visual noise (header button) → ambient chip hue 40 on hub only.
Drawer-inline chat retained. primeContext enrichment added (`profileId`, `contractId`, `module`).

### Start Point (Conflict C)
Employee-first PRIMARY. Template-first `Send til ansatte…` SECONDARY (bulk-send from Maler tab).
Reverse flow from `/dashboard/employees/[id]` supported.

### Prior Council Staleness (Conflict D)
2026-04-09 "non-functional shell" claim FALSIFIED by Agent-coord + Supervisor.
Stall is performance (virtualization + spring tuning), not wiring.
→ L-0098 logged; 14-day verification rule promoted.

### Lineage Columns (Conflict E)
`contract_template` gets FIVE new columns (both intents merged):
- `source_template_id` (FK, nullable) — lineage
- `source_template_version` (text, nullable) — drift-detection anchor
- `forked_at` (timestamptz, nullable) — when fork happened
- `published_at` (timestamptz, nullable) — lifecycle start
- `deprecated_at` (timestamptz, nullable) — lifecycle retire
- `CHECK (source_template_id IS NULL OR forked_at IS NOT NULL)`

## Merge Gates (G1-G5, all blocking)
- G1: Fix `is_admin_in_workspace(uuid,uuid)` signature inversion (migration 20260422120000 vs 20260228140000). Pre-flight.
- G2: Register 5 template events in telemetry registry before UI: `contract_template.forked/clause_updated/published/deprecated/deleted`
- G3: `is_system` immutability via BEFORE UPDATE trigger (not app guard)
- G4: Every new capability tool has explicit `gate_action` + `default_allow=false`
- G5: Lineage columns per Conflict E

## Capability Surface
**Min before Maler tab ships:** `fork_template`, `publish_workspace_template`, `deprecate_workspace_template` — all chat-only, gated, in `packages/ai/src/tools/contract/`.
**Defer to Phase 5:** `edit_clause` (web-only, NOT in mobile suggestTools per ADR-0133), `industry_intelligence` capability (new, ADR-0180 proposed).

## Docs to Write (Phase 0)
- ADR-0178: K1a→K1b lineage + drift detection
- ADR-0179: Template vs Contract lifecycle separation
- ADR-0180: industry_intelligence capability (proposed only, deferred)
- L-0098: Prior-council-verdict staleness pattern (4th occurrence)
- L-0099: Tabs-in-hub vs split-IA resolution pattern
- L-0100: primeContext enrichment as alternative to removing affordance

## Risks
- R1 Q1=B without lineage (HIGH → LOW after G5)
- R2 RLS inversion (HIGH → LOW after G1)
- R3 is_system mutable at app layer (MED → LOW after G3)
- R4 tool gate bypass (MED → LOW after G4)
- R5 prior-council staleness repeating (MED, systemic — L-0098 addresses)
- R6 drawer perf regression (LOW with virtualization)

## Follow-ups
- Promote "14-day prior-verdict verification rule" to `run-council` skill
- Promote "capability trust gate enumeration rule" (6 items) to skill
