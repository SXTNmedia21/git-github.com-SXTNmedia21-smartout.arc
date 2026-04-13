---
title: "Communications as Cascade Consumer — C2 Contract"
id: ADR_0087
status: accepted
layer: decision
created: 2026-04-13
updated: 2026-04-13
---

# ADR-0087: Communications as Cascade Consumer — C2 Contract

## Context and Problem Statement

The Komm (communications) module is a well-built generic chat system with channels, messages, voice calls, and notifications. However, it does not leverage Smartout's cascade model (I1+6D+4C+K1a/K1b). Channel tables have cascade FKs (department_id, team_id, session_id) that are inert. The `channel_ai_policy` and `channel_event` tables exist with zero consumers. AI tools are CRUD wrappers with no intelligence. A System Council review (2026-04-13) found 3 critical runtime bugs, 20+ i18n violations, and complete disconnection from the cascade intelligence layer.

The question: should Communications pull cascade data directly, or should it receive cascade-derived intelligence through a defined contract?

## Decision Drivers

- Cascade invariant: domain logic lives inside the cascade pipeline, not beside it
- The C2 Interaction Control Plane is defined in the cascade spec but unimplemented
- Event Engine is the established delivery mechanism for cross-domain triggers
- Current Komm hooks query `planning_event` directly — this pattern should not expand
- Shift workers need intelligence-driven communications, not a generic chat timeline
- Mobile parity requires data layer in packages/, not apps/web/

## Considered Options

1. **Make Komm cascade-aware** — Add dimension queries (D6 sessions, D2 staffing, C1 KPIs) directly to Komm hooks and components
2. **Communications as cascade consumer via C2** — Define C2 as the translation layer, Event Engine as delivery, Komm as display surface
3. **Build a monolithic intelligence middleware** — New package between cascade and Komm that aggregates all dimension data

## Decision Outcome

Chosen option: **"Communications as cascade consumer via C2"**, because it preserves cascade invariants, uses existing Event Engine infrastructure, and keeps Komm as a thin display layer that receives composed intelligence rather than querying raw cascade state.

### Architecture Contract

```
Cascade Pipeline (D1-D6, C1-C4, K1a/K1b)
    ↓ produces derived state
C2 Interaction Control Plane
    ↓ translates to context-aware explanations
Event Engine (engine_event → engine_dispatch)
    ↓ delivers via process steps
channel_event / channel_message
    ↓ consumed by
Komm UI (hooks → components)
```

### Specific Commitments

1. **No new cascade queries in Komm hooks.** The existing `planning_event` query in `use-communication-overview.ts` is grandfathered but must not be extended to other dimension tables.
2. **C2 outputs arrive as channel_message or channel_event inserts**, performed by Event Engine process steps — not by UI code.
3. **Proactive messaging (shift briefings, handoff summaries, KPI alerts) are Event Engine processes**, triggered by calendar guardian or cascade state changes.
4. **channel_ai_policy governs Botsson's per-channel participation**, enforced in the agent-router pipeline.
5. **Briefing composition is an AI tool** (`compose_shift_briefing`) that reads D2+D6+K1b+D3, not a Komm hook.

## Rules & Consequences

- **Good, because** cascade domain logic stays centralized; Komm remains a thin, testable display layer
- **Good, because** intelligence delivery is auditable through Event Engine process logs
- **Good, because** mobile and web consume the same channel_message/channel_event data
- **Bad, because** C2 must be formally defined before Communications gets intelligence (dependency)
- **Bad, because** existing direct query pattern (planning_event) creates precedent that must be explicitly grandfathered
- **Agent Impact:** Never add cascade dimension queries to apps/web/src/app/dashboard/komm/. Intelligence content arrives via channel_message/channel_event inserts from Event Engine processes. Build AI tools in packages/ai/src/capabilities/, not in Komm hooks.

---

> Council session: 2026-04-13. Agents: system-steward, supervisor, system-agent-coordinator, frontend-designer. Verdict: APPROVE WITH CHANGES.
