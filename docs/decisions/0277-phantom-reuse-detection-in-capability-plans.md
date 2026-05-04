---
title: "Phantom-Reuse Detection Mandatory in Capability Plans"
id: ADR_0277
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
depends_on: [ADR_0078, ADR_0099, ADR_0204]
---

# ADR-0277: Phantom-Reuse Detection Mandatory in Capability Plans

## Context and Problem Statement

During the 2026-05-04 council review of ADR-0275 (Voice Plane Consolidation), harness-builder phantom-trace revealed that three of the original R4 "reuse" claims were false:

- `update_season` was claimed as reuse of the `season` capability. Code-trace of `packages/ai/src/capabilities/tools/season/` found `createSeason`, `setRevenue`, `savePlaybook`, `getReadiness`, and `learnFactors` — no `update_season` exists.
- `add_procedures` was claimed as reuse of the `governance` capability. Code-trace found `governance` has only `check_readiness` (read-only) — no `add_procedures` exists.
- `scrape_website` was claimed as reuse of `tools/intelligence/scrape`. Code-trace found only `types.ts:204` with a client-tool return type — no server-side `scrape_website` tool exists.

The original R4 stated "6 new + 7 reuse + 1 client-only = 14 tools". The true count is 8-9 net-new tools or bridges, not 6.

The root cause is a recurring pattern: ADRs and capability plans are written from a feature-spec perspective, naming tools by what they should do. Code-trace is deferred or skipped entirely. The difference between "capability X should have tool Y" (desired state) and "capability X has tool Y at file:line" (current state) is not verified before the plan is accepted.

L-0176 (2026-04-29) established per-tool body-trace as a mandatory check when reviewing a single capability tool. This ADR promotes that discipline to per-plan scope for any multi-tool capability migration.

## Decision Drivers

- Inflated reuse counts distort effort estimation and timeline promises for sorties.
- Plans accepted without phantom-trace produce incorrect ADR R-rules (ADR-0275 R4 is wrong as written).
- Three-reuse-claim inflation in one plan shows the pattern is not isolated to ADR-0275.
- L-0176 body-trace discipline has already proven effective at per-tool level (caught `tools.ts:282` docstring claiming ADR-0204 compliance while body had 3 direct writes outside `gatedMutation`).
- Council Phase 3 is the natural enforcement point — this is when harness-builder and coordinator review capability plans before sorties open.

## Considered Options

1. **No change** — rely on per-tool L-0176 enforcement during implementation.
2. **Per-plan phantom-trace table (this decision)** — require a verification table for every multi-tool capability plan, produced at planning time, before any sortie opens.
3. **Automated static analysis** — CI step scanning capability registries for claimed vs actual tool names.

## Decision Outcome

Chosen option: **"Per-plan phantom-trace table"**, because it closes the gap at planning time (before any implementation work begins), costs one focused code-read session per plan, and requires no new tooling. Option 1 defers the cost to implementation where errors are more expensive to unwind. Option 3 is the right long-term investment but requires a capable registry query pattern that does not yet exist.

## Rules & Consequences

- **R1 (Phantom-trace table required):** Every capability plan or ADR claiming ≥1 tool reuse MUST include a phantom-trace audit table. The table must contain at minimum one row per claimed reuse with:
  - Tool name claimed for reuse
  - Existing capability tool name (must match exact `defineTool({name: "..."})` value or equivalent)
  - Existing tool location (file:line)
  - Verified emit name + emit prefix (must not collide with existing registry entries)
  - At least one verified call site if the tool currently has consumers
  If any field cannot be filled with direct code citations, the tool is reclassified as **NEW BUILD**, not reuse.

- **R2 (Council Phase 3 mandate):** System Council Phase 3 dispatch always assigns harness-builder or coordinator the code-tracer mandate when a plan contains ≥3 reuse claims. This is non-optional — even if the session author is confident in the claims.

- **R3 (Pre-sortie gate):** Phantom-trace must be completed BEFORE any sortie opens. Plans that ship without phantom-trace verification are blocked at Phase 6 user confirmation. A plan file without a phantom-trace table for its reuse claims is incomplete.

- **R4 (Steward gate):** ADR drafts claiming reuse without phantom-trace evidence are flagged for rejection at steward verification. The steward may request a phantom-trace table before accepting.

- **Good, because** effort estimation and ADR R-rules reflect reality at planning time, not discovered at implementation.
- **Good, because** phantom-trace is a focused, time-bounded activity — one code-read session per plan is sufficient.
- **Good, because** extends L-0176 discipline (already established and understood by all agents) to the planning horizon.
- **Bad, because** adds a required step to capability planning sessions that may increase planning time for plans with many claimed reuses.
- **Bad, because** does not prevent phantom-reuse in plans written by agents that do not apply phantom-trace discipline — enforcement still depends on council review catching non-compliant plans.

- **Agent Impact (build agents):** When given a "reuse" instruction in a plan, verify body presence before assuming. If a claimed tool does not exist at the cited capability, report phantom claim back to orchestrator as a critical finding before proceeding.
- **Agent Impact (coordinator):** Include phantom-trace table in Phase 3 review for any multi-tool capability plan. Do not advance to Phase 4 without table complete.
- **Agent Impact (harness-builder):** Phantom-trace is now part of standard Phase 3 review when ≥3 reuse claims appear. Run `defineTool({name:` grep on the claimed capability directory before confirming reuse.
- **Agent Impact (steward):** Phantom-trace audit is a Phase 7 verification gate before merge. Any ADR that was produced by a plan without a verified phantom-trace table requires retroactive trace before acceptance.

## Precedent

- **L-0176 (2026-04-29):** Per-tool body-trace caught `tools.ts:282` claiming ADR-0204 compliance while body at lines 443-481 had 3 direct writes outside `gatedMutation`. Scope: single tool.
- **This ADR (2026-05-04):** Per-plan body-trace caught 3 inflated reuse claims in ADR-0275 R4 (`update_season`, `add_procedures`, `scrape_website`). True cost 8-9 net-new tools, not 6. Scope: multi-tool capability migration plan.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
