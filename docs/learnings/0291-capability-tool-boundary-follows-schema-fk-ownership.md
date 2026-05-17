---
title: "L-0291 — Capability tool boundary follows existing schema FK ownership — do not split capabilities mid-pivot"
id: L_0291
status: active
date: 2026-05-17
layer: learning
created: 2026-05-17
updated: 2026-05-17
tags: [capability, adr-0173, schema, fk, payroll, tariff, mid-pivot, architecture]
related_adrs: [ADR-0173, ADR-0350, ADR-0351, ADR-0353]
related_learnings: [L-0278]
---

# L-0291 — Capability tool boundary follows existing schema FK ownership — do not split capabilities mid-pivot

## What happened

System-agent-coordinator Phase 3 (dynamic-MCP-fetch pivot council, 2026-05-17): the coordinator proposed introducing a new capability (`tariff_admin` or `workspace_setup`) to house the three new tools (`setup_workspace_tariff`, `change_workspace_tariff`, `add_supplement_override`). Rationale offered: these tools have an administrative setup character distinct from the calculation character of the existing `payroll` capability.

Coordinator code-trace refuted this: `grep -rn "workspace_settings\|is_tariff_bound\|active_union\|active_binding_id" packages/ai/src/capabilities/` returned all hits inside `payroll/tools.ts`. Zero hits in any other capability. The schema FKs that the new tools would read and write are already owned by the `payroll` capability.

ADR-0173 (frozen-4 capability boundaries) governs this: a tool lives in the capability that owns the schema FKs it touches. Splitting capabilities requires an explicit ADR-0173 amendment — a rare and high-bar decision.

## Rule

When proposing new capability tools mid-pivot, the correct placement test is:

1. Grep for the FK columns the new tool will read/write
2. Identify which existing capability owns those FKs in `tools.ts`
3. The new tool lives in that capability — no exceptions without an ADR-0173 amendment

"Character" of the tool (setup vs calculation vs admin) is NOT the boundary criterion. Schema FK ownership is the boundary criterion.

## Resolution

`setup_workspace_tariff`, `change_workspace_tariff`, and `add_supplement_override` all live in the `payroll` capability (per ADR-0353). No new capability introduced. ADR-0173 frozen-4 boundaries enforced without amendment.

## Generalization

This is a recurring pattern: when a pivot introduces new tools that "feel" like a different domain, the architectural instinct is to create a new capability. The correct check is always schema FK ownership first. If FKs span multiple capabilities, that signals a potential split — but only when the schema ownership itself warrants an ADR-0173 amendment, not when the "character" of the tools differs.

Related: L-0278 (capability split is an ADR trigger when tools cross authority boundaries — not the same as when they cross conceptual domain boundaries).
