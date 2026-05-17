---
title: "Handoff — lovsen-phase-7d-pivot-adrs"
feature: lovsen-phase-7d-pivot-adrs
status: done
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [handoff, payroll, lovsen, dynamic-mcp-fetch, adrs]
---

# Handoff — lovsen-phase-7d-pivot-adrs

## Summary

Phase 7d shipped 5 ADRs (0350–0354, 1225 lines), 3 learnings (L-0289/0290/0291, 116 lines), one council audit doc (215 lines), and 4 ADR amendments (ADR-0341/0342/0348/0349), establishing the complete architectural foundation for the dynamic-MCP-fetch pivot ratified by council on 2026-05-17. Phase 7e (bridge code: `lovsen-client.ts` + BFF routes) and Phase 7f (capability tools + onboarding wizard step + admin inbox UI) follow once trust-gate items resolved — no schema migration or implementation code was shipped in this sortie.

---

## Decisions Made

### ADR-0350 — Bridge Transport (HTTP-via-BFF)

The capability layer communicates with the lovsen MCP server exclusively via HTTP through the existing BFF (workspace-api gateway). Direct Python MCP socket connections from the browser are forbidden. The capability HTTP client is the approved implementation pattern. Foundational decision — all Phase 7e implementation is gated on this transport contract.

### ADR-0351 — Tariff Floor Enforcement

UP adjustments (employer supplements above the Riksavtalen floor) are permitted. DOWN adjustments (paying below the tariff minimum) are forbidden at the DB level via a CHECK constraint, not a soft warning. Statutory basis: Aml. §14-15. This is a non-negotiable floor; no capability tool, manual override, or admin bypass may circumvent it.

### ADR-0352 — `derive_supplement_set` MCP Contract (Python-owned)

The `derive_supplement_set` tool is Python-owned synthesis. The capability layer calls this tool with `workspace_id + period_start + period_end` and surfaces the result deterministically. The capability layer does not reimplement derivation logic. This contract freezes the boundary: TypeScript owns the call, Python owns the computation.

### ADR-0353 — `workspace_framework_binding` Lifecycle

A workspace binds to exactly one regulatory framework per period. The binding is immutable after the first payroll period is locked. Re-binding requires a new row with a future `effective_from` — updates to existing rows are forbidden. This lifecycle rule prevents retroactive tariff-rate changes from corrupting locked payroll periods.

### ADR-0354 — Freshness Ops (Heartbeat Cron)

A heartbeat cron runs every 24 h to call `derive_supplement_set` and detect drift between stored and live Riksavtalen rates. If delta exceeds threshold, a `payroll.tariff_drift_detected` telemetry event is emitted. No auto-apply — operator must confirm via capability tool. This is the operational safety net between council-ratified rate updates and workspace-level binding.

### 4 ADR Amendments — Role-Shifts

- **ADR-0341 (calc-engine authority):** Narrowed to exclude rate derivation. Calc-engine is authoritative for arithmetic, not for tariff-rate sourcing.
- **ADR-0342 (supplement rule storage):** Amended to reference `workspace_framework_binding` as the authoritative source for supplement rules. Stored supplement rules must carry a `workspace_framework_binding_id` FK.
- **ADR-0348 (payroll period lock):** Extended with a tariff-snapshot requirement: a snapshot of the active tariff rates must be captured before a period can be locked. No lock without snapshot.
- **ADR-0349 (export format):** Amended to include a `tariff_source` provenance column in all CSV and PDF exports, so auditors can trace every supplement line to its originating tariff version.

---

## Learnings Discovered

### L-0289 — Chair must verify ADR subject before citing it in council

During council Phase 3 (2026-05-17), Chair cited ADR-0250 as the basis for a constraint, but ADR-0250 covers a different domain than assumed. Council caught the misread; Chair reversed position in session. Rule: when council motion references an ADR, Chair reads the ADR title and status aloud before the vote proceeds. 6th occurrence of the L-0147 pattern (council citing stale or wrong ADR subject).

### L-0290 — NHO cirkulær primary date is the `gjelder_fra` field, not `publisert`

When sourcing Riksavtalen rate tables from NHO cirkulær documents, the `gjelder_fra` date governs tariff validity, not `publisert`. Using `publisert` as primary date produces a 1–3 week shift in effective rate windows and can incorrectly classify supplements for shifts in the gap period. The `derive_supplement_set` MCP tool must index on `gjelder_fra` exclusively.

### L-0291 — Capability boundary follows schema FK, not domain intuition

The boundary between the calc-engine capability and the lovsen MCP capability was initially drawn by domain intuition ("tariff = external, supplement = internal"). The code-trace revealed the correct boundary is structural: wherever a schema FK points to `workspace_framework_binding`, that column's data is MCP-territory. Capability tools must not reimplement logic for any column with this FK in its lineage. Rule: when authoring a new capability tool, grep the schema for FK chains before assigning ownership.

---

## Known Issues / Debt

### Schema migration NOT shipped (Phase 7d-followup)

The following schema objects are required by ADRs 0350–0354 but were not migrated in this sortie:
- `payroll.workspace_framework_binding` table (ADR-0353 lifecycle)
- `payroll.tariff_snapshot` table (ADR-0348 amendment)
- `active_union` column on `payroll.workspace_settings` (ADR-0353 binding source)
- DB CHECK constraint enforcing tariff floor (ADR-0351)
- `tariff_source` column on export tables (ADR-0349 amendment)

This is intentional: schema migrations ship in Phase 7d-followup as a separate sortie with its own migration file and RLS review.

### Bridge code NOT shipped (Phase 7e)

- `lovsen-client.ts` (capability HTTP client per ADR-0350)
- BFF route additions to workspace-api gateway
- Telemetry events for bridge calls

### Capability tools NOT shipped (Phase 7f)

- `setup_workspace_tariff` (initial binding wizard step)
- `change_workspace_tariff` (re-binding tool with future `effective_from`)
- `add_supplement_override` (above-floor employer supplement tool)
- Onboarding wizard step for tariff selection
- Admin inbox UI for drift alert review

### Worksheet rate correction superseded

The worksheet rate correction task (pre-pivot) is superseded. The dynamic pivot removes worksheet authority over rates entirely — rates now come from `derive_supplement_set` MCP output, not the worksheet. No separate fix needed; Phase 7e bridge implementation naturally replaces the worksheet-rate path.

### 358 cert-cells carry pre-pivot lineage (BOOTSTRAP-BACKFILL required)

358 certification cells stamped `lovsen-mcp@v1` still carry pre-pivot rate derivation lineage. These will be re-derived in Phase 7c per ADR-0353 BOOTSTRAP-BACKFILL procedure once the `workspace_framework_binding` table exists and bindings are seeded for the 3 migrated Bubble workspaces.

---

## Next Steps

1. **Phase 7d-followup (schema migration sortie):** Write migration for 5 tables/columns listed above. RLS review required. Run `pnpm turbo typecheck` + `pnpm supabase db lint` before close.
2. **Phase 7e (bridge implementation):** Implement `lovsen-client.ts`, BFF routes, telemetry. ADR-0350 is the spec. Typecheck + smoke test required.
3. **Phase 7f (capability tools + UI):** Implement `setup_workspace_tariff`, `change`, `add_supplement_override`. Onboarding wizard step. Admin inbox UI for drift alerts. ADR-0351/0352/0354 are the specs.
4. **BOOTSTRAP-BACKFILL (Phase 7c follow-on):** Seed `workspace_framework_binding` rows for Strøm Mat & Bar, Bårdshaug Vegkro, Yogurt Heaven (3 migrated Bubble workspaces). Re-derive 358 cert-cells via `derive_supplement_set`.
