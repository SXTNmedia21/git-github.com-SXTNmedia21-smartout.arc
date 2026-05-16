---
title: "Page-tool authority semantics — propose-* tools are confirmation-flow openers, not C4 authority-bearing"
id: ADR_0324
status: proposed
layer: decision
created: 2026-05-14
updated: 2026-05-14
module: governance
tags: [page-tools, harness, c4-authority, adr-0287, confirmation-flow, propose-pattern]
---

# ADR-0324: Page-tool authority semantics

## Context

The 2026-05-14 polish wave shipped 33 page-tool bridges. Each registers tools via `useRegisterTools("<surface>", kit)` against `apps/web/src/app/Botsson/_components/tool-registry`. Page-tools fall into 4 patterns:

1. **Read tools** (~60%): list/get/search — no mutation, no authority needed
2. **Navigation tools** (~15%): openX/switchY — `router.push` or `setActiveFilter`, no DB write
3. **Propose-flow tools** (~20%): `proposeActivateSeason`, `proposeArchiveSeason`, `proposeAdvanceStep`, `proposePunchIn`, etc. — dispatch a UI action via Server Action OR CustomEvent OR injected callback. Intent: "LLM suggests action; user confirms in UI."
4. **Direct-mutation tools** (~5%): rare, should be avoided.

The propose-* pattern is novel. The 2026-05-14 Polish-Wave QA Council found two failure modes:

- **Dead-drop CustomEvent** (B1 from Polish-Wave QA Council): bridge dispatches event with zero listener. LLM reports success; nothing happens. 7 instances found: `botsson:shift-clock:punch-in/out/start-break/end-break/switch-tab` (shift-clock bridge), `my-contract:download`, `botsson:setup:advance`.
- **Re-exposing pre-existing ungated mutation** (B2): bridge opens a dialog whose Save handler does direct browser `supabase.update()`. Pre-existing bug, but bridge amplifies blast radius from user-only to agent-callable. Example: EditDepartmentDialog in organization bridge.

Without explicit ADR governance, every polish wave can repeat these mistakes.

## Decision

Page-tool bridges MUST classify each tool with one of three explicit modes:

- **`mode: "read"`** — pure read or client-state filter. No authority gate, no emit.
- **`mode: "navigate"`** — `router.push` or filter setter only. No authority gate, no emit. Tool description MUST NOT use mutation verbs.
- **`mode: "propose"`** — opens a confirmation flow. The TOOL itself is authority-FREE (no `gateAction` in the bridge); the RECEIVING mutation MUST be authority-bearing. Bridge declares `confirmationMode: "open-dialog" | "server-action"`:
  - `"server-action"`: calls a Server Action that internally runs `gateAction` + `emit`. (Example: `activate-season-action.ts`)
  - `"open-dialog"`: dispatches a CustomEvent OR invokes injected `uiActions.<verb>()` that opens a dialog. Dialog Save handler MUST run `gateAction` + `emit` server-side.

**Forbidden patterns:**
- `mode: "propose"` + `confirmationMode: "open-dialog"` + no listener registered = lie-to-voice-user. Caught by L-0256 (dead-drop CustomEvent detector).
- `mode: "propose"` + downstream dialog/handler with browser-direct `supabase.update()` = blast-radius amplification. Caught by L-0260 (wave-amplifies-pre-existing).

**Bridge JSDoc MUST declare modes truthfully.** Docstring drift = L-0176 sibling violation.

### Preferred Pattern: uiActions Injection

Replace CustomEvent dispatchers with `uiActions` injection — bridge receives mutation callbacks as props from the page that mounts it. Pattern documented in `season-tools-bridge.tsx` (calls Server Action) and `contracts-tools-bridge.tsx` (calls uiActions.router.push). Eliminates dead-drop class entirely.

### Existing 33 Bridges — Retrofit Scope

Existing bridges shipped without mode classification. M3/M4 sortie scope covers:
- Mode classification retrofit for all 33 bridges
- Authority-config seeds for all propose-* and direct-mutation tools
- Collision detector for tool-registry Object.assign (see ADR-0325)
- Dead-drop listener audit (see L-0256)

## Consequences

**Positive:**
- Council reviewers can per-tool check mode + receiver match per Trust Gate
- CI lint becomes possible: grep dispatched event names against listener names
- Authority-config seeds clarify: only direct-mutation tools need seeds; propose-* inherit from receiving mutation
- Blast-radius expansion from new bridges is detectable pre-merge

**Negative:**
- Existing 33 bridges shipped without mode classification — retrofit needed (M3/M4 sortie scope)
- New `confirmationMode` field on ClientToolDefinition adds bridge complexity
- Dead-drop detection CI requires stable event name convention across bridge + listener

## Cross-references

- ADR-0204 (gatedMutation orchestrator)
- ADR-0287 (gate_action mandatory on mutation capability tools)
- ADR-0240 (cross-namespace prohibition — page-tools are out-of-scope of capability writes)
- ADR-0323 (Pre-Promote-Preview Council Protocol — parent council framework)
- L-0176 (docstring drift)
- L-0177 (silent workspace-mismatch)
- L-0254 (harness-bridge-reexposes-emit-gaps — same family)
- L-0256 (Bridge CustomEvent dead-end — 7 instances 2026-05-14)
- L-0257 (ADR-0238 phantom-contract accumulator)
- L-0258 (Tool-registry Object.assign collision)
- L-0259 (Hook-emit-location docstring drift, L-0176 sibling)
- L-0260 (Polish-wave-amplifies-pre-existing-debt)
- Polish-Wave QA Council 2026-05-14 (verdict APPROVE WITH CHANGES — B1+B2)
