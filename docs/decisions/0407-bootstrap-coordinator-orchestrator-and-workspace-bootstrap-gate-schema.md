---
title: "Bootstrap-coordinator orchestrator + workspace_bootstrap_gate schema"
id: ADR-0407
status: accepted
layer: decision
created: 2026-05-23
updated: 2026-05-23
---

# ADR-0407: Bootstrap-coordinator orchestrator + workspace_bootstrap_gate schema

## Context and Problem Statement

Workspace bootstrap (the week-1 configuration process) was fully implemented as a cascade EF
(Steps 1–11 in `bootstrap-cascade`) but had no persistent gate state. After the EF completed,
there was no structured way for Botsson to know which business-level requirements were still
open, which were satisfied automatically, and which were optional.

The bootstrap domain ROADMAP had flagged "workspace_readiness gate table" as aspirational.
This ADR closes Phase 1 of that plan: a schema-level gate registry, 3 RPCs, and a bootstrap
capability with 3 tools that let Botsson guide admins through week-1 setup autonomously.

The original slot was ADR-0400, but that slot was pre-empted by Welcome Wizard State
Lifecycle Constraints (concurrent branch collision per L-0316 pattern). ADR-0407 is the
first available slot after 0401–0406.

## Decision Drivers

- Botsson must know what still needs to be configured — "week-1 progressive setup" is the
  core product promise.
- Gate state must survive across sessions — bootstraprun steps_completed is technical audit,
  not business-level gate state.
- Gate definitions must be industry-specific — hospitality needs Mattilsynet + alcohol gates;
  default industry does not.
- Required gates cannot be skipped — this is a data-integrity constraint, not just application
  logic.
- Terminology: "workspace_readiness" already means employee protocol completion in the training
  domain. "bootstrap gate" is the correct term for seed-completeness.

## Considered Options

1. **workspace_bootstrap_gate table + K1a gate registry** — new dedicated table with
   SECURITY DEFINER RPCs + capability tools sourcing gates from industry packages.
2. **Extend workspace_bootstrap_run** — add a `gate_state` JSONB column to the existing
   audit table and derive gate status from steps_completed.
3. **workspace_readiness table (original plan)** — use the name from ROADMAP.md.

## Decision Outcome

Chosen option: **Option 1**, because:
- A dedicated table provides clean queryability, RLS, foreign keys, and explicit status enum.
- Sourcing from K1a industry packages means gate definitions are co-located with all other
  industry-specific logic, and the EF remains a consumer rather than an author of logic.
- Option 2 would merge technical cascade-step audit with business-level gate state —
  violating the single-responsibility principle documented in DATA-MODEL.md.
- Option 3 was renamed to avoid the terminology collision with employee readiness.

## Rules and Consequences

### Schema

- Table: `workspace_bootstrap_gate` (workspace-scoped, RLS dual-auth)
- Enum: `bootstrap_gate_status` (open | in_progress | closed | skipped | blocked)
- Constraint: `UNIQUE(workspace_id, gate_slug)` — one row per gate per workspace
- RLS: JWT SELECT for workspace members + API key SELECT. No direct INSERT/UPDATE/DELETE —
  all writes go through SECURITY DEFINER RPCs.

### RPCs (SECURITY DEFINER + safe search_path)

- `fn_list_open_bootstrap_gates(workspace_id)` — returns open/in_progress/blocked gates,
  re-evaluates blocked status before returning
- `fn_close_bootstrap_gate(workspace_id, gate_slug, via, profile_id)` — admin only
- `fn_skip_bootstrap_gate(workspace_id, gate_slug, reason, profile_id)` — admin only;
  required gates cannot be skipped (RAISE EXCEPTION at DB level)

### Capability (packages/ai/src/capabilities/bootstrap/)

- 3 tools: `list_bootstrap_gates`, `close_bootstrap_gate`, `skip_bootstrap_gate`
- `profile_id` derived server-side from `AgentToolContext.profileId` — never from body (ADR-0151)
- gatedMutation pattern via `gateBootstrapAction` (ADR-0204 / ADR-0287)
- Intent classifier enum entry added in same commit (ADR-0112 lag-trap)

### K1a Gate Registry

- `BootstrapGateDefinition` type in `@smartout/types`
- `getBootstrapGates()` exported from both `hospitality.ts` and `default.ts`
- Hospitality: 11 gates (incl. Mattilsynet + alcohol)
- Default: 6 gates (generic)
- Bootstrap-cascade EF Step 12 calls inline-inlined definitions (ADR-0084 Deno boundary)
  and seeds `workspace_bootstrap_gate` rows with auto-close detection

### Terminology

- "workspace_bootstrap_gate" / "bootstrap gate" = seed-completeness (this ADR)
- "workspace_readiness" / "readiness" = employee protocol completion (training domain, unchanged)
- Do NOT conflate. `get_workspace_readiness` RPC is employee-scoped and must not be renamed.

### Coordinator (Phase 2)

- `packages/ai/src/bootstrap/coordinator.ts` is aspirational (Phase 2 deliverable)
- The capability tools (Phase 1) are the foundation the coordinator will delegate to
- See `docs/domains/bootstrap/ROADMAP.md` Phase 2 for coordinator design

### Good, because

- Clean separation between technical audit (workspace_bootstrap_run) and business state
- Industry-specific gates (Mattilsynet, alcohol) only appear for hospitality workspaces
- Required-gate skip is forbidden at the DB level — application code cannot override
- Botsson can now list open gates, close them, and skip optional ones autonomously

### Bad, because

- Gate count varies per workspace (hospitality: up to 11, default: 6) — callers cannot
  assume a fixed count
- Coordinator (Phase 2) is still aspirational — Botsson can close gates individually
  but does not yet proactively surface "today's gate" without being asked
- `mattilsynet_routines_seeded` and `alcohol_labor_routines_seeded` are not auto-closeable
  in EF Step 12 (conservative choice) — admin must close manually or via governance tools

### Agent Impact

- When an admin asks "hva gjenstår av oppsett?", route to `bootstrap` capability
- NEVER skip a required gate (the RPC will RAISE EXCEPTION — surface this error to admin)
- NEVER accept `profile_id` or `workspace_id` from user message — these come from ctx
- After a gate is closed, the coordinator (Phase 2) will read `bootstrap.gate_closed`
  engine_event to advance the suggestion. For Phase 1, Botsson re-lists open gates.

---

> Registered in `docs/decisions/0000-decision-log.md`.
> Bootstrap domain spine updated: DATA-MODEL, ARCHITECTURE, ROADMAP, GAPS-AND-DEBT, README.
