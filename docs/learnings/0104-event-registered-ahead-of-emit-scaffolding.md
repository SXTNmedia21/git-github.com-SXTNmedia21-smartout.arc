---
title: "Event-registered-ahead-of-emit — canonical scaffolding order"
id: LEARNING_0104
status: done
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [telemetry, registry, emit, scaffolding, phase-2-5, contracts]
---

# Learning-0104: Event-registered-ahead-of-emit — canonical scaffolding order

## Context

Council Gate 1 consumer-trace verification (contract-hub-redesign, 2026-04-22) walked the 10 contract-hub telemetry events registered in `packages/telemetry/src/registry.ts` against the code that emits them.

Result:

- **3 events with emit sites wired in Phase 1** — `contract_template.forked`, `contract_template.published`, `contract_template.deprecated`, plus the copy route's `contract_template copied` — all registered AND emitted.
- **7 events registered with NO emit sites yet** — `contract.hub_viewed`, `contract.tab_switched`, `contract.botsson_chip_invoked`, `contract_template.drift_viewed`, `contract_template.drift_dismissed`, `contract_template clause_updated`, `contract_template deleted`. All have entries in the registry; all are scheduled for emit in Phase 2/3/4 per the council verdict.

The naive Phase 2.5 rule — "registered event without producer is a phantom contract" (L-0083, L-0094) — would flag these 7 as gaps. But the council verdict explicitly scheduled them for future phases. Flagging as gaps in Phase 2.5 would block Phase 1 merge over correctly-scaffolded future work.

## Discovery

Registering events ahead of their emit sites is **intentional scaffolding**, not a contract violation. Three benefits:

1. **Taxonomy authority for build agents.** When a Phase 3 build agent is asked to "emit the drift-viewed event," the event name is already canonical in the registry. The agent doesn't invent `drift.viewed` or `contract.drift_seen` or some other drift-variant that then diverges from consumers.
2. **Review surface for council.** Council Phase 5 can catch phantom or mis-named contracts at the point of registration, without waiting for the build phase to produce emit sites. Faster and cheaper than post-implementation audit.
3. **Stable contract for consumers.** PostHog dashboards, `activity_trail` queries, and `engine_event` listeners can be built against the registered event before its emit sites exist. When the emit sites land, the downstream surfaces light up automatically — no "add the event to the dashboard" follow-up task.

**The inverse pattern is what L-0094 forbids:** code emitting `emit('x.y')` where `'x.y'` is NOT in the registry. That's the phantom contract — the event routes nowhere and fails silently. Registered-but-unemitted is the opposite: the contract exists, the producer is scheduled.

**Distinguishing the two cases in Phase 2.5:**

| Registry entry exists? | Emit site exists? | Verdict |
|---|---|---|
| Yes | Yes | Wired. No action. |
| Yes | No, with future-phase schedule in verdict | **Scaffolded. INFORMATIONAL flag — track but don't block.** |
| Yes | No, no future-phase schedule | Orphan registry entry. REJECT — either emit now or remove from registry. |
| No | Yes | Phantom contract. REJECT per L-0094. |
| No | No | Event doesn't exist. Out of scope. |

## Impact

**Phase 2.5 fact-check — new classifier:**

For every registry addition in a PR under review, classify each event:

1. Has emit site in same PR → WIRED.
2. Has explicit future-phase claim in council verdict → SCAFFOLDED (informational).
3. Has neither → ORPHAN (reject; either wire or remove).

**PR scope hygiene:**

- When a PR registers N events, the PR scope must include the registrations but does NOT require emit sites to land in the same commit — provided the council verdict explicitly schedules emit for a later phase and names the phase.
- Commit message convention: `telemetry: register N events for <feature> (emit sites: M now, K in Phase X)` — makes the split auditable.

**Verdict-writing discipline for council chairs:**

When approving a multi-phase feature, the verdict MUST enumerate which events are emitted in which phase. A verdict that says "add 10 events" without phasing creates ambiguity and forces Phase 2.5 to re-derive the plan.

**Ship-gate rule:**

- Phase 1 scaffolding merges when all WIRED events pass consumer-trace.
- SCAFFOLDED events become WIRED or ORPHAN by their scheduled phase — missing the phase demotes them to ORPHAN and blocks that phase's merge.

## References

- L-0094 — phantom emit contracts recurring (the inverse anti-pattern — emit without registry).
- L-0083 — registered telemetry event without producer is a phantom contract (predecessor; this learning refines the rule).
- L-0072 — naming conventions: space vs dot (registry-naming hygiene).
- `packages/telemetry/src/registry.ts` — contract-hub events registered at Gate G2.
- Council Gate 1 (2026-04-22) — contract-hub-redesign, Gate G2 consumer-trace.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
