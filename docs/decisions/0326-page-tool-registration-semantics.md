---
title: "Page-tool registration semantics — sharedMount flag, identity rules"
id: ADR_0326
status: proposed
layer: decision
created: 2026-05-14
updated: 2026-05-14
module: governance
tags: [page-tools, harness, tool-registry, registration, sharedMount, adr-0325]
---

# ADR-0326: Page-tool registration semantics

## Context

ADR-0325 resolves tool-name collision via Hybrid D+C+A. Phase 2 introduces `sharedMount: true` flag to allow ONE tool definition to mount from multiple page bridges. This requires explicit registration semantics — what does it mean for two bridges to register "the same" tool?

The 2026-05-14 polish-wave council surfaced 11 collisions in page-tool registry. Frontend Designer's Alternative D reframed the problem: most collisions represent the SAME operation viewed from different mount points (e.g. `listOpenDeviations` across governance/hms/hms-deviations), not different operations sharing a name.

The collision detector (ADR-0325 Phase 1, shipped 2026-05-14) fires `console.error` grace mode on all 11. Phase 2 dedupe needs a registration contract so the detector can distinguish allowed shared-mounts from forbidden genuine conflicts.

## Decision

**Page-tool registration rules:**

1. **Single-mount default:** A page-tool registers under a globally unique `modelToolName` within its bridge scope. Default behavior — no flag needed.

2. **Shared-mount opt-in:** A single tool definition MAY be mounted from multiple bridges via `useRegisterTools(source, kit, { sharedMount: true })`. The detector (ADR-0325 Phase 1) allows duplicate registration ONLY when ALL registrations have `sharedMount: true`.

3. **Identity invariant:** Shared-mount registrations MUST reference the SAME definition object. Pattern:
   ```ts
   // apps/web/src/lib/page-tools/shared/list-open-deviations.ts
   export const listOpenDeviationsTool = { /* ONE definition */ };

   // apps/web/src/app/dashboard/hms/_tools/hms-tools-bridge.tsx
   useRegisterTools("hms", { ...other, ...sharedTools }, { sharedMount: true });
   ```

4. **Mount-context awareness:** Implementation MAY differ by mount context (e.g. `useHmsContext()` vs `useGovernanceContext()`) but the `modelToolName`, `description`, and parameter schema MUST be identical across all mounts.

5. **Three-layer affordance taxonomy** (clarifies ADR-0173 + ADR-0324):
   - **Capability** (`packages/ai/src/capabilities/`) — frozen-4 boundary per ADR-0173. Server-side. Owns table writes.
   - **Page-tool** (`_tools/use-<page>-tools.ts`) — presentation-layer affordance. Client-side. Mounted on a page. May call capabilities.
   - **Shared-mount page-tool** (`apps/web/src/lib/page-tools/shared/`) — ONE definition shared across N bridges via `sharedMount: true`.

## Consequences

**Positive:**
- Resolves Frontend Designer's structural critique: duplicates collapse to ONE definition, not N renames
- Detector enforces invariant at registration time (once `sharedMount` flag support is added)
- LLM sees clean tool catalogue (no duplicate entries)
- Future capability-vs-tool-vs-mount clarity for new bridge authors

**Negative:**
- Adds new optional options parameter to `useRegisterTools()` signature (Phase 2 sortie work)
- Phase 2 dedupe audit cost: 11 collisions need classification
- `sharedMount: true` is opt-in trust — author must verify definitions are truly identical
- `apps/web/src/lib/page-tools/shared/` directory scaffold is Phase 2 sortie scope (NOT Phase 1)

## Deferred

- `useRegisterTools(source, kit, { sharedMount: true })` signature change: Phase 2 sortie
- `apps/web/src/lib/page-tools/shared/` directory scaffolding: Phase 2 sortie
- Detector promotion from `console.error` to `throw`: after Phase 2 dedupe confirms 0 unresolved conflicts

## Cross-references

- ADR-0325 (tool-name discipline — companion, resolved same council)
- ADR-0173 (frozen-4 capability namespace boundary — clarifies that page-tools are NOT capabilities)
- ADR-0240 (capability ownership — applies to writes, not page-tool names)
- ADR-0287 (gate_action coverage — applies to mutation capability tools, not view-state page tools)
- ADR-0288 (voice tool guards — voice channel keys on capability, not page-tool name)
- ADR-0324 (page-tool authority semantics — read/navigate/propose/direct-mutation modes)
- L-0258 (Tool-registry Object.assign collision — root finding)
- L-0260 (Polish-wave amplifies pre-existing — related)
- L-0263 (Frontend reframe outpaced opus chairs — Alternative D reframe origin)
