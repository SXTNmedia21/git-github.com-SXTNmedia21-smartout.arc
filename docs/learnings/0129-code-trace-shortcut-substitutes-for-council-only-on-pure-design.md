---
id: L-0129
title: "Code-trace-shortcut substitutes for full council only on pure design decisions"
status: accepted
updated: 2026-04-23
created: 2026-04-23
module: governance
tags: [council, orchestration, code-trace, design-vs-integration, L-0050, ADR-0201]
---

# L-0129: Code-trace-shortcut substitutes for full council only on pure design decisions

## Context

2026-04-23 M3 (ADR-0201 Season Agent Capability) shipped via code-trace shortcut — 5 architect open questions resolved by targeted Explore agent reading journey precedent + schedule/helpdesk_query precedents. No full 4-reviewer council. Orchestrator judgment: "all 5 Qs have single right answers in the codebase; council would duplicate work."

Post-merge council 2026-04-23 (same day, after merge) dispatched the full 5-reviewer round. Agent-coord Phase 3 caught 3 blocker-class issues the code-trace shortcut missed:

1. **CapabilityName union omits `season.archive`, `season.duplicate`** despite being seeded in migration 20260518030000 and referenced as gateAction literals in Server Actions. The type union exists for ADR-0189 parity enforcement; skipping it widens the security surface. Shortcut didn't check because the Qs were about architecture shape, not post-merge consumer-trace.

2. **Phantom-emit `operating_hours_generated` on re-activation** — when a previously-archived season is reactivated, D1 rows persist, trigger `NOT EXISTS` short-circuits, RPC returns `rows_generated: N` (read as count of existing rows), Server Action still emits with `source: 'auto_copy_on_activate_trigger'`. Trigger did nothing; emit attributes to trigger. ADR-0196 Invariant 11 violation. Shortcut didn't check because re-activation idempotency was resolved as "safe" in Q-D architecturally, but the telemetry attribution semantic wasn't traced.

3. **Orphan `archiveSeason` client mutation** at `use-seasons.ts:151-187`. M1 correctly deleted `activateSeason` client mutation (L-0098 flip). M4 added archive Server Action but forgot to delete the parallel client mutation. Same gate-bypass pattern. Shortcut didn't check because M4 was outside ADR-0201 scope.

Briefing fact-check also falsified one claim (5th occurrence of L-0050 audit-inflation pattern): *"availability/tools.ts + shift-swap/tools.ts emit with dotted names while registry uses space-separated"* — FALSE. Registry uses dotted names (lines 4333-4389 + 7942-7950). Both sides agreed. Grep-based audit inflation strikes again.

## The pattern

Code-trace shortcut is valid when:
- All open questions have deterministic right answers in existing code (precedent lookup, not judgment)
- The work is purely structural (type shapes, naming conventions, file organization)
- No new DB migrations or consumer-surface changes land
- No capability registration or authority surface widens

Code-trace shortcut is INVALID when any of these apply:
- The work lands 3+ migrations (each a consumer-surface change)
- Capability registry grows (CapabilityName union, registry.ts, intent-classifier)
- Server Actions or capability tools ship (gateAction + emit integration paths)
- Any cross-cutting invariant applies (ADR-0189 parity, ADR-0196 invariants 11-13)

M3 had ALL four "invalid" signals. Shortcut was taken anyway. 3 blockers missed.

## What to do

1. **Default to full council** for any campaign milestone that registers a capability, adds authority rows, or ships Server Actions.
2. **Reserve code-trace-shortcut** for pure design decisions within a single file/module where the pattern precedent is unambiguous.
3. **Phase 3 agent-coord Layer 2+4 trace is non-optional** for integration-surface work. That trace caught all 3 blockers here.
4. **When in doubt, spend the 15 min** on a full council rather than save time and pay it back in post-merge cleanup sorties (M5 here = 4-6 hours).

## Verify

Next 3 campaigns that ship capability registration: measure whether council-vs-shortcut correlates with blocker-count-found-post-merge. If pattern holds, promote this learning into run-council SKILL.md as a hard rule at Phase 1 agent selection.

## Related

- L-0050 — Audit inflation: grep-based claims must be code-traced (5th occurrence today)
- L-0123 — Code-trace catches what grep-briefing misses
- L-0127 — Loader-level bugs evade grep-audits
- ADR-0196 — Invariants 11/12/13 (phantom capability, falsifiable claims, gate_action)
- ADR-0201 — Season Agent Capability (this ADR was accepted via code-trace shortcut)
