---
title: "Tool-name discipline — page-scoped prefix convention for harness tool registry"
id: ADR_0325
status: accepted
layer: decision
created: 2026-05-14
updated: 2026-05-14
module: governance
tags: [page-tools, harness, tool-registry, naming, collision, adr-0324, adr-0326]
---

# ADR-0325: Tool-name discipline — page-scoped prefix convention

## Context

`apps/web/src/app/Botsson/_components/tool-registry.ts` uses `Object.assign(implementations, set.implementations)` and `definitions.push(...)` to merge tool kits from all registered page bridges. The merge is **silent last-wins** on duplicate `modelToolName`.

The 2026-05-14 Polish-Wave QA Council (Agent-coord code-trace) initially found 9 confirmed name collisions from the 33-bridge wave. A full sweep by Botsson Harness Builder confirmed **11 collisions across 241 modelToolName entries in 46 bridges**:

| Duplicate `modelToolName` | Count |
|---------------------------|-------|
| `listOpenDeviations` | 3 |
| `switchStatusFilter` | 2 |
| `listTeams` | 2 |
| `proposeActivateSeason` | 2 |
| `getUnreadCount` | 2 |

Count note: briefing said 9, supervisor spot-check found 5, Harness Builder full sweep found 11. Full sweep is authoritative (L-0261). Practical co-mount UX collisions: 2 (`getUnreadCount`, `switchStatusFilter`).

When the LLM receives duplicate definitions in the tool array, it sees ambiguous entries. Execution routes to whichever implementation won the Object.assign race (mount order). The other implementation is silently dropped.

**Critical note (Agent-Coord code-trace):** Page-tool registry does NOT reach the LLM today via the voice plane. Verified: `services/voice-agent/src/adapter.ts:177-186` uses a static capability catalogue; `packages/agent-sdk/src/providers/livekit.ts:38-40` `registerTool()` is a stub. The latent bomb fires when LiveKit stub becomes real — at that point silent overwrite becomes silent misroute. Phase 1 detector preempts that bomb (L-0262).

## Problem Statement

Four approaches were considered by the follow-up council (2026-05-14 evening).

### Option A — Page-scoped prefix convention (wholesale)

Format: `<page-slug>.<toolName>` — e.g. `hms.listOpenDeviations`, `schedule.listOpenDeviations`.

Pros: zero collision class, self-documenting, traceable to source bridge.
Cons: 241 renames, high churn. Agent-Coord code-trace proved page-tool registry doesn't reach LLM today — rename cost exceeds current bug impact. Wholesale A rejected (30:1 churn ratio, no current bug fixed).

### Option B — Central allowlist

Maintain a `TOOL_NAME_ALLOWLIST` map in `tool-registry.ts`. Registration throws if name not in allowlist.

Pros: compile-time enforcement, no rename required.
Cons: allowlist becomes merge-conflict hotspot; legitimizes structural duplicates instead of resolving them. Parallel-registry smell per ADR-0288 §considered-options-2 anti-pattern. Frontend Designer structural critique: Option B alone rejected.

### Option C — Runtime collision detector

At registration time, `console.error` (grace) or `throw` (hard) when duplicate `modelToolName` detected.

Pros: immediate detection, zero breaking change, deployable same-sortie.
Cons: does not prevent collisions — only surfaces them faster. Shipped as Phase 1 of Hybrid.

### Alternative D — Semantic dedupe (Frontend Designer reframe)

Reframe "collision as conflict" → "collision as duplicate-OR-conflict." Most collisions represent the SAME operation viewed from different mount points, not different operations sharing a name. Semantic dedupe classifies each collision, collapses true duplicates to shared mounts in `apps/web/src/lib/page-tools/shared/` via `sharedMount: true` flag (ADR-0326). Only genuine conflicts survive to targeted rename (Phase 3).

This reframe caught by Frontend Designer (sonnet) while three opus reviewers accepted briefing framing. See L-0263.

## Decision

**Hybrid D + C + A-targeted-on-survivors** — 3-phase sequenced resolution.

**Phase 1 (this sortie):** Collision detector in `useRegisteredTools()` — `console.error` grace mode, future promotion to `throw`. Closes Agent-Coord's latent bomb (LiveKit registerTool stub silent-overwrite when implemented).

**Phase 2 (follow-up sortie):** Alternative D — Semantic dedupe. Audit 11 colliding names. For each, classify duplicate (same operation, multiple mount points) vs conflict (different operations, name collision). Duplicates collapse to shared mount in `apps/web/src/lib/page-tools/shared/` via `sharedMount: true` flag. Expected: 6-8 of 11 collapse, 3-5 survive as genuine conflicts.

**Phase 3 (after dedupe):** Option A targeted rename — survivors only. Naming convention `<verb><PageSlug><Noun>` (camelCase integrated prefix, NOT dot-separated). Examples: `getNotificationsUnreadCount`, `getKommUnreadCount`, `switchContractsStatusFilter`, `switchProposalsStatusFilter`.

**Rejected:**
- Option A wholesale (rename all 241 entries to `<slug>.<tool>`) — 30:1 churn ratio, no current bug fixed, breaks no LLM (verified by Agent-Coord: zero hits in `packages/ai/src/prompts/`, page-tool registry doesn't reach voice-agent via `services/voice-agent/src/adapter.ts:177-186` static catalogue, `packages/agent-sdk/src/providers/livekit.ts:38-40` registerTool is stub).
- Option B central allowlist alone — Frontend Designer's structural critique stands. Allowlist legitimizes structural duplicates instead of resolving them. Parallel-registry smell per ADR-0288 §considered-options-2 anti-pattern.
- Option A targeted on 11 — renames duplicates that should collapse. Entrenches "name == identity" assumption.

**Page-bridge tool names are presentation-layer affordances, NOT capability IDs.** ADR-0173 frozen-4 boundary doesn't apply. ADR-0240 applies to writes, not names. ADR-0288 voice guard keys on capability not tool-name.

**Authoritative collision count: 11 names across 46 bridges (241 modelToolName entries total).** Verified by Harness Builder full sweep. Practical UX co-mount collision count: 2 (`getUnreadCount`, `switchStatusFilter`).

## Consequences

**Immediate (Phase 1 — shipped):**
- Collision detector in `useRegisteredTools()` merge loop — `console.error` in dev, not yet throw
- 11 existing collisions fire on web app load (Phase 2 dedupe sortie addresses)
- Latent bomb preempted: when LiveKit stub becomes real, detector surfaces issue immediately

**Phase 2 (follow-up sortie):**
- Semantic dedupe audit of 11 collisions
- `sharedMount: true` flag added to `useRegisterTools()` signature (ADR-0326)
- `apps/web/src/lib/page-tools/shared/` directory scaffolded with shared definitions
- Detector promoted to `throw` after dedupe confirms 0 unresolved conflicts

**Phase 3 (after dedupe):**
- Targeted rename of 3-5 surviving genuine conflicts
- camelCase prefix convention: `get<PageSlug><Noun>`, `switch<PageSlug><Aspect>`

## Cross-references

- ADR-0324 (page-tool authority semantics — companion ADR from same council)
- ADR-0326 (page-tool registration semantics — sharedMount flag, identity invariant)
- L-0258 (Tool-registry Object.assign collision — root finding 2026-05-14)
- L-0261 (Briefing collision counts are spot-checks — 5/9/11 reconciliation)
- L-0262 (Naming churn cost bounded by name flow — Agent-Coord file:line proof)
- L-0263 (Frontend reframe outpaced opus chairs — Alternative D reframe pattern)
- Polish-Wave QA Council 2026-05-14 (M3 finding: tool-registry collision detector)
- ADR-0325 decision council 2026-05-14 (late evening — Hybrid D+C+A verdict)
- Verified file:line citations from Agent-Coord: `services/voice-agent/src/adapter.ts:177-186`, `packages/agent-sdk/src/providers/livekit.ts:38-40`, `apps/web/src/app/api/wizard/start/route.ts:108-130`
- `apps/web/src/app/Botsson/_components/tool-registry.ts` (Phase 1 detector shipped)
